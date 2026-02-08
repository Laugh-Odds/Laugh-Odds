import 'meme.dart';

class Market {
  final int id;
  final String creator;
  final BigInt endTime;
  final BigInt yesVotes;
  final BigInt noVotes;
  final BigInt totalStaked;
  final bool isActive;
  final String metadata;
  final List<Meme> memes;

  Market({
    required this.id,
    required this.creator,
    required this.endTime,
    required this.yesVotes,
    required this.noVotes,
    required this.totalStaked,
    required this.isActive,
    required this.metadata,
    required this.memes,
  });

  bool get isExpired =>
      DateTime.now().millisecondsSinceEpoch ~/ 1000 > endTime.toInt();

  Duration get timeRemaining {
    final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final diff = endTime.toInt() - now;
    return Duration(seconds: diff > 0 ? diff : 0);
  }

  String get timeRemainingText {
    final d = timeRemaining;
    if (d.inSeconds <= 0) return 'Ended';
    if (d.inDays > 0) return '${d.inDays}d ${d.inHours % 24}h';
    if (d.inHours > 0) return '${d.inHours}h ${d.inMinutes % 60}m';
    return '${d.inMinutes}m';
  }

  int get totalVotes => yesVotes.toInt() + noVotes.toInt();
}
