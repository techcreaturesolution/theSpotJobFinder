import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../app_state.dart';
import '../models.dart';
import '../widgets/jobs_table.dart';

class JobDetailScreen extends StatefulWidget {
  const JobDetailScreen({super.key, required this.job});
  final Job job;

  @override
  State<JobDetailScreen> createState() => _JobDetailScreenState();
}

class _JobDetailScreenState extends State<JobDetailScreen> {
  bool _busy = false;

  Future<void> _open(Uri uri) async {
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication) &&
        mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Could not open $uri')));
    }
  }

  Future<void> _apply([String? link]) async {
    setState(() => _busy = true);
    try {
      final data = await AppScope.of(context).api
          .post('/jobs/${widget.job.id}/apply', {'link': ?link});
      await _open(Uri.parse(data['url'] as String));
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _row(String label, String value, {VoidCallback? onTap}) {
    if (value.isEmpty) return const SizedBox.shrink();
    return ListTile(
      dense: true,
      title: Text(label, style: Theme.of(context).textTheme.labelMedium),
      subtitle: Text(
        value,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: onTap != null ? Theme.of(context).colorScheme.primary : null,
        ),
      ),
      onTap: onTap,
    );
  }

  @override
  Widget build(BuildContext context) {
    final j = widget.job;
    final meta = AppScope.of(context).meta;
    return Scaffold(
      appBar: AppBar(
        title: Text(j.companyName.isEmpty ? 'Job details' : j.companyName),
      ),
      bottomNavigationBar: j.canApply
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: FilledButton.icon(
                  onPressed: _busy ? null : () => _apply(),
                  icon: const Icon(Icons.open_in_new),
                  label: Text(
                    j.applyOptions.isEmpty
                        ? 'Apply by email'
                        : 'Apply on ${j.applyOptions.first.title}',
                  ),
                ),
              ),
            )
          : null,
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 12),
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              j.title,
              style: Theme.of(context).textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                Chip(
                  label: Text(
                    j.verified
                        ? 'Verified${j.verificationMethod.isEmpty ? '' : ' · ${j.verificationMethod.replaceAll('_', ' ')}'}'
                        : 'Unverified',
                  ),
                ),
                if (j.level.isNotEmpty) Chip(label: Text(j.level)),
                if (j.workFromHome) const Chip(label: Text('Work from home')),
                for (final e in j.education)
                  Chip(label: Text(meta?.educationLabel(e) ?? e)),
              ],
            ),
          ),
          _row('Company', j.companyName),
          _row(
            'Company website',
            j.companyWebsite,
            onTap: j.companyWebsite.isEmpty
                ? null
                : () => _open(Uri.parse(j.companyWebsite)),
          ),
          _row('Location', j.location),
          _row('Address', j.address),
          _row('Qualification', j.educationText),
          _row('Experience', j.experienceText),
          _row('Salary', j.salary),
          _row('Employment type', j.employmentType),
          _row('Posted', j.postedAt == null ? '' : shortDate(j.postedAt)),
          _row(
            'Last date to apply',
            j.validThrough == null ? '' : shortDate(j.validThrough),
          ),
          _row('Source', j.platform),
          for (final e in j.emails)
            _row(
              'Email',
              e,
              onTap: () => _open(
                Uri(
                  scheme: 'mailto',
                  path: e,
                  queryParameters: {'subject': 'Application for ${j.title}'},
                ),
              ),
            ),
          for (final p in j.phones)
            _row(
              'Contact number',
              p,
              onTap: () => _open(
                Uri(scheme: 'tel', path: p.replaceAll(RegExp(r'[^\d+]'), '')),
              ),
            ),
          if (j.applyOptions.length > 1) ...[
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Text('Also listed on'),
            ),
            for (final o in j.applyOptions.skip(1))
              ListTile(
                dense: true,
                leading: const Icon(Icons.link),
                title: Text(o.title),
                onTap: _busy ? null : () => _apply(o.link),
              ),
          ],
          if (j.description.isNotEmpty) ...[
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 4),
              child: Text(
                'Job description',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SelectableText(j.description),
            ),
          ],
        ],
      ),
    );
  }
}
