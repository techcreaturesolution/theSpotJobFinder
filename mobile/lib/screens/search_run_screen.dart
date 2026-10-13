import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../app_state.dart';
import '../models.dart';
import '../widgets/banner_ad.dart';
import '../widgets/jobs_table.dart';
import 'video_ad_gate.dart';

class SearchRunScreen extends StatefulWidget {
  const SearchRunScreen({
    super.key,
    required this.searchId,
    this.initialPostedWithin,
  });
  final String searchId;
  final int? initialPostedWithin;

  @override
  State<SearchRunScreen> createState() => _SearchRunScreenState();
}

class _SearchRunScreenState extends State<SearchRunScreen> {
  JobSearch? _search;
  List<Job> _items = const [];
  String _error = '';
  Timer? _poll;
  late int _filterPostedWithin;
  String _filterQuery = '';
  final _queryController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _filterPostedWithin = widget.initialPostedWithin ?? 0;
    WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
    _poll = Timer.periodic(const Duration(seconds: 2), (_) => _refresh());
  }

  @override
  void dispose() {
    _poll?.cancel();
    _queryController.dispose();
    super.dispose();
  }

  List<Job> get _filteredJobs {
    final q = _filterQuery.trim().toLowerCase();
    return _items.where((j) {
      if (_filterPostedWithin > 0 && !j.matchesPostedWithin(_filterPostedWithin)) {
        return false;
      }
      if (q.isNotEmpty) {
        final content =
            '${j.title} ${j.companyName} ${j.location} ${j.description}'.toLowerCase();
        if (!content.contains(q)) return false;
      }
      return true;
    }).toList();
  }

  Future<void> _refresh() async {
    try {
      final data = await AppScope.of(context).api
          .get('/jobs/searches/${widget.searchId}');
      final search = JobSearch.fromJson(data['search'] as Map<String, dynamic>);
      final items = uniqueJobs(
        (data['items'] as List? ?? []).map(
          (e) => Job.fromJson(e as Map<String, dynamic>),
        ),
      );
      if (!mounted) return;
      setState(() {
        _search = search;
        _items = items;
        _error = '';
        if (_filterPostedWithin == 0 && search.postedWithin > 0 && widget.initialPostedWithin == null) {
          _filterPostedWithin = search.postedWithin;
        }
      });
      if (!search.running && !search.locked) _poll?.cancel();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = _search;
    Widget body;
    if (s == null) {
      body = Center(
        child: _error.isEmpty
            ? const CircularProgressIndicator()
            : Text(_error),
      );
    } else if (s.locked) {
      body = VideoAdGate(searchId: s.id, onUnlocked: _refresh);
    } else if (s.running) {
      body = const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text(
                'Searching Google Jobs, company career pages and job portals, and re-verifying every listing against its source…',
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    } else if (s.failed) {
      body = Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            s.error.isEmpty
                ? 'The job search failed. Please try again.'
                : s.error,
          ),
        ),
      );
    } else {
      final filtered = _filteredJobs;
      body = Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: TextField(
              controller: _queryController,
              decoration: InputDecoration(
                hintText: 'Filter results by keyword…',
                prefixIcon: const Icon(Icons.filter_list, size: 20),
                suffixIcon: _filterQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () {
                          _queryController.clear();
                          setState(() => _filterQuery = '');
                        },
                      )
                    : null,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 8,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                isDense: true,
              ),
              onChanged: (v) => setState(() => _filterQuery = v),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              children: [
                for (final opt in const [
                  (0, 'All dates'),
                  (1, 'Last 24 hours'),
                  (3, 'Last 3 days'),
                  (7, 'Last 7 days'),
                  (30, 'Last 30 days'),
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(
                        opt.$2,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: _filterPostedWithin == opt.$1
                              ? FontWeight.bold
                              : FontWeight.normal,
                        ),
                      ),
                      selected: _filterPostedWithin == opt.$1,
                      visualDensity: VisualDensity.compact,
                      onSelected: (selected) {
                        setState(() {
                          _filterPostedWithin = selected ? opt.$1 : 0;
                        });
                      },
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: JobsTable(jobs: filtered, hiddenUnverified: s.hiddenUnverified),
          ),
        ],
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: Text(s == null || s.prompt.isEmpty ? 'Job results' : s.prompt),
      ),
      bottomNavigationBar: s != null && !s.locked ? const BannerAdBox() : null,
      body: body,
    );
  }
}
