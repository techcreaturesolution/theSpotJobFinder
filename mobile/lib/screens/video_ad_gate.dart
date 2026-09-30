import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:video_player/video_player.dart';

import '../api.dart';
import '../app_state.dart';
import '../config.dart';

enum _Mode { loading, rewarded, verifying, timed, error }

/// Blocks results until the server confirms the ad: AdMob rewarded video (verified server-side by Google's
/// SSV callback) when configured, otherwise a timed video whose watch time the server counts.
class VideoAdGate extends StatefulWidget {
  const VideoAdGate({
    super.key,
    required this.searchId,
    required this.onUnlocked,
  });
  final String searchId;
  final VoidCallback onUnlocked;

  @override
  State<VideoAdGate> createState() => _VideoAdGateState();
}

class _VideoAdGateState extends State<VideoAdGate> with WidgetsBindingObserver {
  static const _verifyWait = Duration(seconds: 30);
  _Mode _mode = _Mode.loading;
  String _message = '';
  int _seconds = 30;
  double _watched = 0;
  bool _playing = false;
  bool _finishing = false;
  Map<String, dynamic>? _demo;
  VideoPlayerController? _video;
  RewardedAd? _rewarded;
  Timer? _frame;
  Timer? _beat;
  Timer? _verifyTimeout;

  String get _endpoint => '/jobs/searches/${widget.searchId}/ad';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _frame?.cancel();
    _beat?.cancel();
    _verifyTimeout?.cancel();
    _video?.dispose();
    _rewarded?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_mode != _Mode.timed) return;
    if (state == AppLifecycleState.resumed) {
      _video?.play();
    } else {
      _video?.pause();
    }
  }

  Future<void> _start() async {
    final app = AppScope.of(context);
    try {
      final info = await app.api.get(_endpoint);
      final gate = info['adGate'] as Map<String, dynamic>;
      if (gate['completed'] == true) return widget.onUnlocked();
      _seconds = (gate['seconds'] as num?)?.toInt() ?? 30;
      _watched = (gate['watchedSeconds'] as num?)?.toDouble() ?? 0;
      _demo = info['demo'] as Map<String, dynamic>?;
      final unit = AppConfig.rewardedUnit(app.admob);
      if (unit != null && app.userId.isNotEmpty) {
        _loadRewarded(unit, app.userId);
      } else {
        await _startTimed();
      }
    } on ApiException catch (e) {
      _fail(e.message);
    }
  }

  void _fail(String message) {
    if (mounted) {
      setState(() {
        _mode = _Mode.error;
        _message = message;
      });
    }
  }

  void _loadRewarded(String unit, String userId) {
    setState(() => _mode = _Mode.rewarded);
    RewardedAd.load(
      adUnitId: unit,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) async {
          if (!mounted) return ad.dispose();
          _rewarded = ad;
          await ad.setServerSideOptions(
            ServerSideVerificationOptions(
              userId: userId,
              customData: widget.searchId,
            ),
          );
          var earned = false;
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdDismissedFullScreenContent: (ad) {
              ad.dispose();
              _rewarded = null;
              if (!mounted) return;
              if (earned) {
                _awaitVerification();
              } else {
                setState(
                  () => _message = 'Watch the whole ad to see your results.',
                );
                _loadRewarded(unit, userId);
              }
            },
            onAdFailedToShowFullScreenContent: (ad, _) {
              ad.dispose();
              _rewarded = null;
              _startTimed();
            },
          );
          ad.show(onUserEarnedReward: (_, _) => earned = true);
        },
        onAdFailedToLoad: (_) => _startTimed(),
      ),
    );
  }

  void _awaitVerification() {
    setState(() {
      _mode = _Mode.verifying;
      _message = 'Confirming the ad with Google…';
    });
    _verifyTimeout = Timer(_verifyWait, () {
      if (!mounted || _mode != _Mode.verifying) return;
      _message = 'Google has not confirmed the ad yet, so a short video will play instead.';
      _startTimed();
    });
  }

  Future<void> _startTimed() async {
    if (!mounted) return;
    final demo = _demo;
    if (demo == null) {
      return _fail(
        'No video ad is available right now. Please try again in a moment.',
      );
    }
    setState(() => _mode = _Mode.timed);
    final url = Uri.parse('${AppConfig.serverOrigin}${demo['videoUrl']}');
    final controller = VideoPlayerController.networkUrl(url);
    _video = controller;
    try {
      await controller.initialize();
      await controller.setLooping(true);
      await controller.setVolume(0);
      controller.addListener(_onVideo);
      await controller.play();
      if (mounted) setState(() {});
    } catch (_) {
      _fail(
        'The video ad could not be loaded. Check your connection and try again.',
      );
    }
  }

  void _send(String event) =>
      AppScope.of(context).api
          .post(_endpoint, {'event': event})
          .catchError((_) => <String, dynamic>{});

  void _onVideo() {
    final playing = _video?.value.isPlaying ?? false;
    if (playing == _playing || !mounted) return;
    setState(() => _playing = playing);
    _send(playing ? 'play' : 'pause');
    _frame?.cancel();
    _beat?.cancel();
    if (!playing) return;
    _frame = Timer.periodic(const Duration(milliseconds: 250), (_) {
      if (_finishing) return;
      setState(() => _watched += 0.25);
      if (_watched >= _seconds) _complete();
    });
    _beat = Timer.periodic(const Duration(seconds: 2), (_) => _send('tick'));
  }

  Future<void> _complete() async {
    _finishing = true;
    final api = AppScope.of(context).api;
    try {
      await api.post(_endpoint, {'event': 'complete'});
      _video?.pause();
      widget.onUnlocked();
    } on ApiException {
      try {
        final info = await api.get(_endpoint);
        final gate = info['adGate'] as Map<String, dynamic>;
        if (gate['completed'] == true) return widget.onUnlocked();
        if (mounted) {
          setState(
            () => _watched =
                (gate['watchedSeconds'] as num?)?.toDouble() ?? _watched,
          );
        }
      } on ApiException catch (e) {
        _fail(e.message);
      }
    } finally {
      _finishing = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final left = (_seconds - _watched).ceil().clamp(0, _seconds);
    final video = _video;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          'SPONSORED VIDEO',
          style: Theme.of(context).textTheme.labelSmall
              ?.copyWith(color: Colors.amber.shade800, letterSpacing: 1.2),
        ),
        const SizedBox(height: 12),
        if (_mode == _Mode.timed &&
            video != null &&
            video.value.isInitialized) ...[
          AspectRatio(
            aspectRatio: video.value.aspectRatio,
            child: VideoPlayer(video),
          ),
          LinearProgressIndicator(value: (_watched / _seconds).clamp(0, 1)),
          const SizedBox(height: 12),
          Text(
            _finishing ? 'Unlocking…' : 'Results in ${left}s',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (!_playing)
            const Text('Paused. The timer only runs while the ad is playing.'),
        ] else if (_mode == _Mode.error)
          const Icon(Icons.error_outline, color: Colors.red, size: 40)
        else
          const CircularProgressIndicator(),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Text(
            _message.isNotEmpty ? _message : 'Your job search is running. Watch the ad to unlock the results.',
            textAlign: TextAlign.center,
          ),
        ),
        if (_mode == _Mode.error)
          TextButton(
            onPressed: () {
              setState(() {
                _mode = _Mode.loading;
                _message = '';
              });
              _start();
            },
            child: const Text('Try again'),
          ),
      ],
    );
  }
}
