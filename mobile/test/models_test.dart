import 'package:flutter_test/flutter_test.dart';
import 'package:thespot_jobfinder/api.dart';
import 'package:thespot_jobfinder/app_state.dart';
import 'package:thespot_jobfinder/models.dart';

Map<String, dynamic> job(
  String id, {
  String title = 'Python Developer',
  String company = 'Acme',
  String location = 'Ahmedabad, Gujarat',
}) => {
  '_id': id,
  'title': title,
  'companyName': company,
  'location': location,
  'applyUrl': 'https://acme.in/jobs/1',
  'applyOptions': [
    {'title': 'Acme', 'link': 'https://acme.in/jobs/1'},
    {'title': 'Naukri', 'link': 'https://naukri.com/1'},
    {'title': 'Naukri', 'link': 'https://naukri.com/1'},
  ],
  'emails': ['HR@acme.in', 'hr@acme.in'],
  'phones': ['+91 98765 43210', '+91 98765 43210'],
  'education': ['be_btech', 'be_btech'],
  'verification': {'status': 'verified', 'method': 'json_ld'},
};

void main() {
  test(
    'parses a job without duplicate links, emails, phones or qualifications',
    () {
      final j = Job.fromJson(job('1'));
      expect(j.applyOptions.map((o) => o.link), [
        'https://acme.in/jobs/1',
        'https://naukri.com/1',
      ]);
      expect(j.emails, ['hr@acme.in']);
      expect(j.phones, ['+91 98765 43210']);
      expect(j.education, ['be_btech']);
      expect(j.verified, isTrue);
      expect(j.canApply, isTrue);
    },
  );

  test('uniqueJobs drops repeated ids and same title/company/city', () {
    final jobs = [
      Job.fromJson(job('1')),
      Job.fromJson(job('1')),
      Job.fromJson(
        job(
          '2',
          title: 'python developer',
          company: 'ACME',
          location: 'Ahmedabad',
        ),
      ),
      Job.fromJson(job('3', company: 'Beta')),
    ];
    expect(uniqueJobs(jobs).map((j) => j.id), ['1', '3']);
  });

  test('parses a locked search', () {
    final s = JobSearch.fromJson({
      '_id': 's1',
      'status': 'running',
      'locked': true,
      'city': 'Surat',
      'state': 'Gujarat',
      'adGate': {
        'required': true,
        'seconds': 60,
        'watchedSeconds': 12,
        'completed': false,
      },
    });
    expect(s.locked, isTrue);
    expect(s.running, isTrue);
    expect(s.adGate.watchedSeconds, 12);
    expect(s.place, 'Surat, Gujarat');
  });

  test('only job seekers without a complete profile are sent to the form', () {
    expect(userNeedsProfile({'role': 'user'}), isTrue);
    expect(
      userNeedsProfile({'role': 'user', 'profileComplete': true}),
      isFalse,
    );
    expect(userNeedsProfile({'role': 'admin'}), isFalse);
    expect(userNeedsProfile(null), isFalse);
  });

  test('validation errors show the field message', () {
    expect(
      errorMessage({
        'error': 'Validation failed',
        'details': [
          {'message': 'Enter a valid 10-digit Indian mobile number'},
        ],
      }, 400),
      'Enter a valid 10-digit Indian mobile number',
    );
    expect(errorMessage({'error': 'Nope'}, 403), 'Nope');
    expect(errorMessage({}, 500), 'Request failed (500)');
  });
}
