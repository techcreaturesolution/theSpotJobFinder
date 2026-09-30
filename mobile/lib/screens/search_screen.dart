import 'package:flutter/material.dart';

import '../api.dart';
import '../app_state.dart';
import '../models.dart';
import '../widgets/banner_ad.dart';
import 'history_screen.dart';
import 'search_run_screen.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _prompt = TextEditingController();
  final _city = TextEditingController();
  String _level = 'fresher';
  String _state = '';
  String _category = '';
  String _education = '';
  int _postedWithin = 30;
  bool _verifiedOnly = true;
  bool _busy = false;
  String _error = '';

  Future<void> _search() async {
    final app = AppScope.of(context);
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      final data = await app.api.post('/jobs/search', {
        'prompt': _prompt.text.trim(),
        'level': _level,
        'category': _category,
        'education': _education,
        'verifiedOnly': _verifiedOnly,
        'state': _state,
        'city': _city.text.trim(),
        'postedWithin': _postedWithin,
      });
      final search = JobSearch.fromJson(data['search'] as Map<String, dynamic>);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => SearchRunScreen(searchId: search.id)),
      );
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _dropdown(
    String label,
    String value,
    List<Option> options,
    ValueChanged<String> onChanged,
  ) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
      items: [
        for (final o in options)
          DropdownMenuItem(
            value: o.key,
            child: Text(o.label, overflow: TextOverflow.ellipsis),
          ),
      ],
      onChanged: (v) => onChanged(v ?? ''),
    );
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final meta = app.meta;
    return Scaffold(
      appBar: AppBar(
        title: const Text('New Jobs'),
        actions: [
          IconButton(
            tooltip: 'Search history',
            icon: const Icon(Icons.history),
            onPressed: () => Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => const HistoryScreen())),
          ),
          IconButton(
            tooltip: 'Logout',
            icon: const Icon(Icons.logout),
            onPressed: app.signOut,
          ),
        ],
      ),
      bottomNavigationBar: const BannerAdBox(),
      body: meta == null
          ? Center(
              child: FilledButton(
                onPressed: () => app.loadMeta().then((_) => setState(() {})),
                child: const Text('Retry loading filters'),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(
                      value: 'fresher',
                      label: Text('Fresher'),
                      icon: Icon(Icons.school_outlined),
                    ),
                    ButtonSegment(
                      value: 'experienced',
                      label: Text('Experienced'),
                      icon: Icon(Icons.work_history_outlined),
                    ),
                  ],
                  selected: {_level},
                  onSelectionChanged: (s) => setState(() => _level = s.first),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _prompt,
                  maxLength: 200,
                  decoration: const InputDecoration(
                    labelText: 'What job are you looking for?',
                    hintText: 'e.g. React developer, accountant with Tally',
                    border: OutlineInputBorder(),
                  ),
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => _busy ? null : _search(),
                ),
                _dropdown('State', _state, [
                  const Option('', 'All India'),
                  for (final s in meta.states) Option(s, s),
                ], (v) => setState(() => _state = v)),
                const SizedBox(height: 12),
                TextField(
                  controller: _city,
                  decoration: const InputDecoration(
                    labelText: 'City (optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                _dropdown('Category', _category, [
                  const Option('', 'All categories'),
                  ...meta.categories,
                ], (v) => setState(() => _category = v)),
                const SizedBox(height: 12),
                _dropdown('Education qualification', _education, [
                  const Option('', 'Any qualification'),
                  ...meta.education.where((e) => e.key != 'any'),
                ], (v) => setState(() => _education = v)),
                const SizedBox(height: 12),
                _dropdown(
                  'Posted within',
                  '$_postedWithin',
                  [
                    for (final d in meta.postedWithin)
                      Option(
                        '$d',
                        d == 0
                            ? 'Any time'
                            : d == 1
                            ? 'Last 24 hours'
                            : 'Last $d days',
                      ),
                  ],
                  (v) => setState(() => _postedWithin = int.tryParse(v) ?? 30),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Verified jobs only'),
                  subtitle: const Text(
                    'Every listing is re-checked against its source on each search',
                  ),
                  value: _verifiedOnly,
                  onChanged: (v) => setState(() => _verifiedOnly = v),
                ),
                const SizedBox(height: 8),
                FilledButton.icon(
                  onPressed: _busy ? null : _search,
                  icon: const Icon(Icons.search),
                  label: Text(_busy ? 'Starting…' : 'Find jobs'),
                ),
                const SizedBox(height: 8),
                Text(
                  meta.dailyLimit == null
                      ? 'A video ad plays with every search. No daily search limit.'
                      : 'A video ad plays with every search. ${meta.searchesToday} of ${meta.dailyLimit} searches used today.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                if (_error.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      _error,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
              ],
            ),
    );
  }
}
