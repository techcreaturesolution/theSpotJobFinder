import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../app_state.dart';
import '../models.dart';
import '../widgets/banner_ad.dart';
import '../widgets/jobs_table.dart';
import 'video_ad_gate.dart';

class SearchRunScreen extends StatefulWidget {
  const SearchRunScreen({super.key, required this.searchId});
  final String searchId;

  @override
  State<SearchRunScreen> createState() => _SearchRunScreenState();
}

class _SearchRunScreenState extends State<SearchRunScreen> {
  JobSearch? _search;
  List<Job> _items = const [];
  String _error = '';
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
    _poll = Timer.periodic(const Duration(seconds: 2), (_) => _refresh());
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
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
      body = JobsTable(jobs: _items, hiddenUnverified: s.hiddenUnverified);
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
