class Meme {
  final String creator;
  final String cid;
  final int memeTemplate;

  Meme({
    required this.creator,
    required this.cid,
    required this.memeTemplate,
  });

  factory Meme.fromContract(List<dynamic> data) {
    return Meme(
      creator: data[0] as String,
      cid: data[1] as String,
      memeTemplate: (data[2] as BigInt).toInt(),
    );
  }
}
