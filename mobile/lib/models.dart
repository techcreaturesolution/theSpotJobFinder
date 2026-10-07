String _s(dynamic v) => v == null ? '' : v.toString();
List<String> _list(dynamic v) => v is List
    ? v.map(_s).where((e) => e.isNotEmpty).toSet().toList()
    : const [];
DateTime? _date(dynamic v) =>
    v == null ? null : DateTime.tryParse(v.toString())?.toLocal();

class Option {
  const Option(this.key, this.label);
  final String key;
  final String label;

  factory Option.fromJson(Map<String, dynamic> j) =>
      Option(_s(j['key']), _s(j['label']));
}

class JobMeta {
  JobMeta({
    required this.categories,
    required this.education,
    required this.levels,
    required this.states,
    required this.postedWithin,
    required this.dailyLimit,
  });

  final List<Option> categories;
  final List<Option> education;
  final List<String> levels;
  final List<String> states;
  final List<int> postedWithin;
  final int dailyLimit;

  factory JobMeta.fromJson(Map<String, dynamic> j) => JobMeta(
    categories: (j['categories'] as List? ?? [])
        .map((e) => Option.fromJson(e as Map<String, dynamic>))
        .toList(),
    education: (j['education'] as List? ?? [])
        .map((e) => Option.fromJson(e as Map<String, dynamic>))
        .toList(),
    levels: _list(j['levels']),
    states: _list(j['states']),
    postedWithin: (j['postedWithin'] as List? ?? [])
        .map((e) => (e as num).toInt())
        .toList(),
    dailyLimit: (j['dailyLimit'] as num?)?.toInt() ?? 0,
  );

  String educationLabel(String key) => education
      .firstWhere((e) => e.key == key, orElse: () => Option(key, key))
      .label;
}

class ApplyOption {
  const ApplyOption(this.title, this.link);
  final String title;
  final String link;
}

class Job {
  Job({
    required this.id,
    required this.title,
    required this.companyName,
    required this.companyWebsite,
    required this.level,
    required this.experienceText,
    required this.education,
    required this.educationText,
    required this.description,
    required this.location,
    required this.address,
    required this.employmentType,
    required this.salary,
    required this.workFromHome,
    required this.postedAt,
    required this.validThrough,
    required this.platform,
    required this.applyOptions,
    required this.emails,
    required this.phones,
    required this.verified,
    required this.verificationMethod,
  });

  final String id;
  final String title;
  final String companyName;
  final String companyWebsite;
  final String level;
  final String experienceText;
  final List<String> education;
  final String educationText;
  final String description;
  final String location;
  final String address;
  final String employmentType;
  final String salary;
  final bool workFromHome;
  final DateTime? postedAt;
  final DateTime? validThrough;
  final String platform;
  final List<ApplyOption> applyOptions;
  final List<String> emails;
  final List<String> phones;
  final bool verified;
  final String verificationMethod;

  bool get canApply => applyOptions.isNotEmpty || emails.isNotEmpty;

  factory Job.fromJson(Map<String, dynamic> j) {
    final seen = <String>{};
    final options = <ApplyOption>[];
    final applyUrl = _s(j['applyUrl']);
    final raw = [
      if (applyUrl.isNotEmpty)
        {'title': j['via'] ?? j['platform'] ?? 'Apply', 'link': applyUrl},
      ...(j['applyOptions'] as List? ?? []),
    ];
    for (final o in raw.cast<Map>()) {
      final link = _s(o['link']);
      if (link.isNotEmpty && seen.add(link)) {
        options.add(
          ApplyOption(_s(o['title']).isEmpty ? 'Apply' : _s(o['title']), link),
        );
      }
    }
    final verification = j['verification'] as Map? ?? const {};
    return Job(
      id: _s(j['_id']),
      title: _s(j['title']),
      companyName: _s(j['companyName']),
      companyWebsite: _s(j['companyWebsite']),
      level: _s(j['level']),
      experienceText: _s(j['experienceText']),
      education: _list(j['education']),
      educationText: _s(j['educationText']),
      description: _s(j['description']),
      location: _s(j['location']),
      address: _s(j['address']),
      employmentType: _s(j['employmentType']),
      salary: _s(j['salary']),
      workFromHome: j['workFromHome'] == true,
      postedAt: _date(j['postedAt']),
      validThrough: _date(j['validThrough']),
      platform: _s(j['platform']),
      applyOptions: options,
      emails: _list(
        (j['emails'] as List? ?? const [])
            .map((e) => _s(e).toLowerCase())
            .toList(),
      ),
      phones: _list(j['phones']),
      verified: verification['status'] == 'verified',
      verificationMethod: _s(verification['method']),
    );
  }
}

class AdGateState {
  const AdGateState({
    required this.required,
    required this.seconds,
    required this.watchedSeconds,
    required this.completed,
  });
  final bool required;
  final int seconds;
  final int watchedSeconds;
  final bool completed;

  factory AdGateState.fromJson(Map<String, dynamic>? j) => AdGateState(
    required: j?['required'] == true,
    seconds: (j?['seconds'] as num?)?.toInt() ?? 0,
    watchedSeconds: (j?['watchedSeconds'] as num?)?.toInt() ?? 0,
    completed: j?['completed'] != false,
  );
}

class JobSearch {
  JobSearch({
    required this.id,
    required this.prompt,
    required this.level,
    required this.state,
    required this.city,
    required this.status,
    required this.error,
    required this.resultCount,
    required this.hiddenUnverified,
    required this.locked,
    required this.adGate,
    required this.createdAt,
  });

  final String id;
  final String prompt;
  final String level;
  final String state;
  final String city;
  final String status;
  final String error;
  final int resultCount;
  final int hiddenUnverified;
  final bool locked;
  final AdGateState adGate;
  final DateTime? createdAt;

  bool get running => status == 'running';
  bool get failed => status == 'failed';
  String get place => [city, state].where((e) => e.isNotEmpty).join(', ');

  factory JobSearch.fromJson(Map<String, dynamic> j) => JobSearch(
    id: _s(j['_id']),
    prompt: _s(j['prompt']),
    level: _s(j['level']),
    state: _s(j['state']),
    city: _s(j['city']),
    status: _s(j['status']),
    error: _s(j['error']),
    resultCount: (j['resultCount'] as num?)?.toInt() ?? 0,
    hiddenUnverified: (j['hiddenUnverified'] as num?)?.toInt() ?? 0,
    locked: j['locked'] == true,
    adGate: AdGateState.fromJson(j['adGate'] as Map<String, dynamic>?),
    createdAt: _date(j['createdAt']),
  );
}

/// Drops repeated jobs (same id, or same title + company + location) so a listing never appears twice.
List<Job> uniqueJobs(Iterable<Job> jobs) {
  final ids = <String>{};
  final identities = <String>{};
  final out = <Job>[];
  String norm(String s) =>
      s.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), ' ').trim();
  for (final j in jobs) {
    final identity =
        '${norm(j.title)}|${norm(j.companyName)}|${norm(j.location.split(',').first)}';
    if (!ids.add(j.id)) continue;
    if (j.companyName.isNotEmpty && !identities.add(identity)) continue;
    out.add(j);
  }
  return out;
}
