import 'package:flutter/material.dart';

import '../api.dart';
import '../app_state.dart';
import '../models.dart';
import 'search_run_screen.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  late Future<List<JobSearch>> _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future = _load();
  }

  Future<List<JobSearch>> _load() async {
    final data = await AppScope.of(context).api.get('/jobs/searches');
    return (data['items'] as List)
        .map((e) => JobSearch.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Recent searches')),
      body: FutureBuilder<List<JobSearch>>(
        future: _future,
        builder: (context, snap) {
          if (snap.hasError) {
            return Center(
              child: Text(
                snap.error is ApiException
                    ? snap.error.toString()
                    : 'Could not load history',
              ),
            );
          }
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final items = snap.data!;
          if (items.isEmpty) {
            return const Center(child: Text('No searches yet'));
          }
          return ListView.separated(
            itemCount: items.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final s = items[i];
              return ListTile(
                title: Text(s.prompt.isEmpty ? 'Category search' : s.prompt),
                subtitle: Text(
                  [
                    s.level,
                    if (s.place.isNotEmpty) s.place,
                    '${s.resultCount} jobs',
                    s.status,
                  ].join(' · '),
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => SearchRunScreen(searchId: s.id),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
