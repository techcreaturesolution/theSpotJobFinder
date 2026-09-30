import 'package:flutter/material.dart';

import '../app_state.dart';
import '../models.dart';
import '../screens/job_detail_screen.dart';

String shortDate(DateTime? d) => d == null
    ? '—'
    : '${d.day.toString().padLeft(2, '0')}-${d.month.toString().padLeft(2, '0')}-${d.year}';

/// Results in tabular form; scrolls horizontally on narrow screens. Tap a row for full details and Apply.
class JobsTable extends StatelessWidget {
  const JobsTable({super.key, required this.jobs, this.hiddenUnverified = 0});
  final List<Job> jobs;
  final int hiddenUnverified;

  @override
  Widget build(BuildContext context) {
    final meta = AppScope.of(context).meta;
    final note = hiddenUnverified > 0
        ? '$hiddenUnverified unverified listings hidden.'
        : '';
    if (jobs.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'No current jobs matched. Try a wider location or fewer filters. $note',
            textAlign: TextAlign.center,
          ),
        ),
      );
    }
    void open(Job j) =>
        Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => JobDetailScreen(job: j)));
    return ListView(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Text('${jobs.length} jobs found. $note'),
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            showCheckboxColumn: false,
            columns: const [
              DataColumn(label: Text('Job')),
              DataColumn(label: Text('Company')),
              DataColumn(label: Text('Location')),
              DataColumn(label: Text('Qualification')),
              DataColumn(label: Text('Experience')),
              DataColumn(label: Text('Salary')),
              DataColumn(label: Text('Contact')),
              DataColumn(label: Text('Posted')),
              DataColumn(label: Text('Status')),
              DataColumn(label: Text('')),
            ],
            rows: [
              for (final j in jobs)
                DataRow(
                  onSelectChanged: (_) => open(j),
                  cells: [
                    DataCell(
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 200),
                        child: Text(
                          j.title,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                    DataCell(
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 160),
                        child: Text(
                          j.companyName.isEmpty ? '—' : j.companyName,
                        ),
                      ),
                    ),
                    DataCell(
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 160),
                        child: Text(j.location.isEmpty ? '—' : j.location),
                      ),
                    ),
                    DataCell(
                      Text(
                        j.education.isEmpty
                            ? 'Not stated'
                            : j.education
                                  .map((e) => meta?.educationLabel(e) ?? e)
                                  .join(', '),
                      ),
                    ),
                    DataCell(
                      Text(
                        j.experienceText.isEmpty
                            ? (j.level.isEmpty ? '—' : j.level)
                            : j.experienceText,
                      ),
                    ),
                    DataCell(Text(j.salary.isEmpty ? '—' : j.salary)),
                    DataCell(
                      Text(
                        [
                          ...j.emails.take(1),
                          ...j.phones.take(1),
                        ].join('\n').ifEmpty('—'),
                      ),
                    ),
                    DataCell(Text(shortDate(j.postedAt))),
                    DataCell(
                      Chip(
                        label: Text(j.verified ? 'Verified' : 'Unverified'),
                        backgroundColor: j.verified
                            ? Colors.green.shade50
                            : Colors.amber.shade50,
                        visualDensity: VisualDensity.compact,
                      ),
                    ),
                    DataCell(
                      TextButton(
                        onPressed: () => open(j),
                        child: Text(j.canApply ? 'Apply' : 'Details'),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ],
    );
  }
}

extension on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}
