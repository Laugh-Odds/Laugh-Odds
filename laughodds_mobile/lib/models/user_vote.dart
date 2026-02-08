class UserVote {
  final String userAddress;
  final int marketId;
  final String vote; // 'funny' or 'lame'
  final String transactionHash;
  final DateTime votedAt;

  UserVote({
    required this.userAddress,
    required this.marketId,
    required this.vote,
    required this.transactionHash,
    required this.votedAt,
  });

  factory UserVote.fromJson(Map<String, dynamic> json) {
    return UserVote(
      userAddress: json['userAddress'] as String,
      marketId: json['marketId'] as int,
      vote: json['vote'] as String,
      transactionHash: json['transactionHash'] as String? ?? '',
      votedAt: DateTime.parse(
          json['votedAt'] as String? ?? DateTime.now().toIso8601String()),
    );
  }
}
