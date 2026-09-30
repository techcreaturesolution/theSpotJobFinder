import 'package:flutter/material.dart';

import '../api.dart';
import '../app_state.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _phone;
  late final TextEditingController _city;
  String _state = '';
  String _level = '';
  String _education = '';
  bool _busy = false;
  bool _initialized = false;
  String _error = '';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) return;
    _initialized = true;
    final user = AppScope.of(context).user ?? {};
    String s(String k) => (user[k] ?? '').toString();
    _name = TextEditingController(text: s('name'));
    _phone = TextEditingController(text: s('phone'));
    _city = TextEditingController(text: s('city'));
    _state = s('state');
    _level = s('level');
    _education = s('education');
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _city.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    final app = AppScope.of(context);
    final wasRequired = app.needsProfile;
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      await app.saveProfile({
        'name': _name.text.trim(),
        'phone': _phone.text.trim(),
        'state': _state,
        'city': _city.text.trim(),
        'level': _level,
        'education': _education,
      });
      if (!mounted) return;
      if (!wasRequired) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Profile saved')));
        Navigator.of(context).maybePop();
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String? _required(String? v, String message) =>
      (v ?? '').trim().isEmpty ? message : null;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final meta = app.meta;
    final first = app.needsProfile;
    return Scaffold(
      appBar: AppBar(
        title: Text(first ? 'Complete your profile' : 'My profile'),
        actions: [
          if (first)
            IconButton(
              tooltip: 'Logout',
              icon: const Icon(Icons.logout),
              onPressed: app.signOut,
            ),
        ],
      ),
      body: meta == null
          ? Center(
              child: FilledButton(
                onPressed: () => app.loadMeta().then((_) => setState(() {})),
                child: const Text('Retry'),
              ),
            )
          : Form(
              key: _form,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (first)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: Text(
                        'Tell us a little about yourself to start searching for jobs.',
                      ),
                    ),
                  TextFormField(
                    initialValue: (app.user?['email'] ?? '').toString(),
                    readOnly: true,
                    decoration: const InputDecoration(
                      labelText: 'Email (from Google)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _name,
                    maxLength: 80,
                    decoration: const InputDecoration(
                      labelText: 'Full name',
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) => (v ?? '').trim().length < 2
                        ? 'Enter your full name'
                        : null,
                  ),
                  const SizedBox(height: 4),
                  TextFormField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    maxLength: 16,
                    decoration: const InputDecoration(
                      labelText: 'Mobile number',
                      prefixText: '+91 ',
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) => _required(v, 'Enter your mobile number'),
                  ),
                  const SizedBox(height: 4),
                  DropdownButtonFormField<String>(
                    initialValue: _state.isEmpty ? null : _state,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'State',
                      border: OutlineInputBorder(),
                    ),
                    items: [
                      for (final s in meta.states)
                        DropdownMenuItem(value: s, child: Text(s)),
                    ],
                    validator: (v) => _required(v, 'Select your state'),
                    onChanged: (v) => setState(() => _state = v ?? ''),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _city,
                    maxLength: 60,
                    decoration: const InputDecoration(
                      labelText: 'City',
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) => _required(v, 'Enter your city'),
                  ),
                  const SizedBox(height: 4),
                  FormField<String>(
                    initialValue: _level,
                    validator: (_) =>
                        _level.isEmpty ? 'Select fresher or experienced' : null,
                    builder: (field) => Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SegmentedButton<String>(
                          emptySelectionAllowed: true,
                          segments: const [
                            ButtonSegment(
                              value: 'fresher',
                              label: Text('Fresher'),
                            ),
                            ButtonSegment(
                              value: 'experienced',
                              label: Text('Experienced'),
                            ),
                          ],
                          selected: {if (_level.isNotEmpty) _level},
                          onSelectionChanged: (s) {
                            setState(() => _level = s.isEmpty ? '' : s.first);
                            field.didChange(_level);
                          },
                        ),
                        if (field.hasError)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              field.errorText!,
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.error,
                                fontSize: 12,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _education.isEmpty ? null : _education,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Highest education',
                      border: OutlineInputBorder(),
                    ),
                    items: [
                      for (final e in meta.education.where(
                        (e) => e.key != 'any',
                      ))
                        DropdownMenuItem(
                          value: e.key,
                          child: Text(e.label, overflow: TextOverflow.ellipsis),
                        ),
                    ],
                    validator: (v) => _required(v, 'Select your education'),
                    onChanged: (v) => setState(() => _education = v ?? ''),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _busy ? null : _save,
                    child: Text(
                      _busy
                          ? 'Saving…'
                          : first
                          ? 'Save and start searching'
                          : 'Save profile',
                    ),
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
            ),
    );
  }
}
