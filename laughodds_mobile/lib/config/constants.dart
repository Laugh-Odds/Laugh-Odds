// Backend API
// const String apiBaseUrl = 'http://10.0.2.2:5000'; // Android emulator
const String apiBaseUrl = 'http://192.168.1.6:5000'; // Physical device LAN IP

// Sepolia (on-chain contract for market data)
const String sepoliaRpcUrl = 'https://1rpc.io/sepolia';
const int sepoliaChainId = 11155111;
const String contractAddress = '0x4c7Bad39Fc980701043a3b03051Cd64835d5e2aA';
const String explorerUrl = 'https://sepolia.etherscan.io';

// WalletConnect
const String wcProjectId = 'd224206a162f026066176507eac5e551';

// Yellow Network (Nitrolite state channels)
const String clearnodeWsUrl = 'wss://clearnet-sandbox.yellow.com/ws';
const String custodyAddress = '0x019B65A265EB3363822f2752141b3dF16131b262';
const String adjudicatorAddress = '0x7c7ccbc98469190849BCC6c926307794fDfB11F2';
const String serverYellowAddress = '0x8108ac6F8eb2945E11938176b7c3EdfC17fF478c';
const String yellowFaucetUrl = 'https://clearnet-sandbox.yellow.com/faucet/requestTokens';
const String voteCostAmount = '0.0001'; // ytest.usd
const String voteAsset = 'ytest.usd';

// Pinata IPFS Upload
const String pinataJwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJlNjc2MDI5Ny0zZmM1LTQxOTQtYjlmMC0zYTE2ZDNjZmZmNmIiLCJlbWFpbCI6ImR1bW15c3RhaW4xOTk5QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiI3YThmMDBhMzg1Y2I1ZGJlNmQ3YyIsInNjb3BlZEtleVNlY3JldCI6ImQ4NjczMDgyYjUyNzkzZTMzZGUxNmJjNzdlNzhiMDQ5MDA0ODIwOTE2NjRjOWQ1OTg3OWViZDg5YjM5Zjk2MzAiLCJleHAiOjE4MDIwNjc5NTh9.XrdiBPnZCbZSvrFUr8OZBiCSRb_X25H6g1L0EwZ8ssQ';

// IPFS Gateways (fallback order)
const List<String> ipfsGateways = [
  'https://gateway.lighthouse.storage/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
];

String ipfsToHttp(String cidOrUrl) {
  if (cidOrUrl.startsWith('http')) return cidOrUrl;
  final cid = cidOrUrl.replaceFirst('ipfs://', '');
  return '${ipfsGateways[0]}$cid';
}

List<String> ipfsToHttpAll(String cidOrUrl) {
  final cid = cidOrUrl
      .replaceFirst('ipfs://', '')
      .replaceFirst(RegExp(r'https?://[^/]+/ipfs/'), '');
  return ipfsGateways.map((gw) => '$gw$cid').toList();
}
