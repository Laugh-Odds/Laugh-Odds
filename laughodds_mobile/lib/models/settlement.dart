class Settlement {
  final int marketId;
  final String winnerSide;
  final String userVote;
  final bool userWon;
  final String userStake;
  final String userPayout;
  final String netResult;
  final int totalVotes;
  final int yesVotes;
  final int noVotes;
  final String settlementTx;
  final DateTime settledAt;

  Settlement({
    required this.marketId,
    required this.winnerSide,
    required this.userVote,
    required this.userWon,
    required this.userStake,
    required this.userPayout,
    required this.netResult,
    required this.totalVotes,
    required this.yesVotes,
    required this.noVotes,
    required this.settlementTx,
    required this.settledAt,
  });

  factory Settlement.fromJson(Map<String, dynamic> json) {
    return Settlement(
      marketId: json['marketId'] as int,
      winnerSide: json['winnerSide'] as String? ?? '',
      userVote: json['userVote'] as String? ?? '',
      userWon: json['userWon'] as bool? ?? false,
      userStake: json['userStake']?.toString() ?? '0',
      userPayout: json['userPayout']?.toString() ?? '0',
      netResult: json['netResult']?.toString() ?? '0',
      totalVotes: json['totalVotes'] as int? ?? 0,
      yesVotes: json['yesVotes'] as int? ?? 0,
      noVotes: json['noVotes'] as int? ?? 0,
      settlementTx: json['settlementTx'] as String? ?? '',
      settledAt: DateTime.parse(
          json['settledAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }
}
