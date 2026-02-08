// Yellow Network (Nitrolite) integration
// State channel payments for instant gasless voting

export const CLEARNODE_WS_URL = process.env.NEXT_PUBLIC_CLEARNODE_WS_URL || 'wss://clearnet-sandbox.yellow.com/ws';
export const CUSTODY_ADDRESS = process.env.NEXT_PUBLIC_YELLOW_CUSTODY || '0x019B65A265EB3363822f2752141b3dF16131b262';
export const ADJUDICATOR_ADDRESS = process.env.NEXT_PUBLIC_YELLOW_ADJUDICATOR || '0x7c7ccbc98469190849BCC6c926307794fDfB11F2';
export const FAUCET_URL = 'https://clearnet-sandbox.yellow.com/faucet/requestTokens';
export const VOTE_COST_AMOUNT = '0.0001'; // ytest.usd decimal amount

let _reqId = 1;
export function nextReqId() {
  return _reqId++;
}

// Nitrolite RPC format: {req: [id, method, params, timestamp], sig: []}
export function buildRequest(method: string, params: object): object {
  return {
    req: [nextReqId(), method, params, Date.now()],
    sig: [],
  };
}

// Parse Nitrolite RPC response: {res: [id, method, result, timestamp], sig: [...]}
export function parseResponse(data: string): { id: number; method: string; result: any } | null {
  try {
    const msg = JSON.parse(data);
    if (msg.res && Array.isArray(msg.res) && msg.res.length >= 3) {
      return { id: msg.res[0], method: msg.res[1], result: msg.res[2] };
    }
    return null;
  } catch {
    return null;
  }
}

// Store auth params for later use in EIP-712 signing
export interface AuthParams {
  address: string;
  session_key: string;
  application: string;
  allowances: Array<{ asset: string; amount: string }>;
  expires_at: number;
  scope: string;
}

export function buildAuthRequest(sessionKey: string, walletAddress: string): { message: object; params: AuthParams } {
  const params: AuthParams = {
    address: walletAddress,
    session_key: sessionKey,
    application: 'ViralForge',
    allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
    expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour in seconds (Unix timestamp)
    scope: 'test.app'
  };
  
  return {
    message: buildRequest('auth_request', params),
    params
  };
}

export function buildAuthVerify(
  signature: string,
  challenge: string
): object {
  // For auth_verify, only challenge is in params
  // The address and session_key are proven by the EIP-712 signature
  const req = [nextReqId(), 'auth_verify', {
    challenge
  }, Date.now()];
  
  return {
    req,
    sig: [signature]  // EIP-712 signature signed by main wallet
  };
}

export function buildVoteTransfer(
  fromAddress: string,
  toAddress: string,
  amount: string,
  marketId: number,
  vote: 'funny' | 'lame',
  nonce: number
): object {
  return buildRequest('Transfer', {
    from: fromAddress,
    to: toAddress,
    asset: 'ytest.usd',
    amount,
    metadata: JSON.stringify({ marketId, vote }),
    nonce,
  });
}

// Request faucet tokens
export async function requestFaucetTokens(walletAddress: string): Promise<boolean> {
  try {
    const response = await fetch(FAUCET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: walletAddress }),
    });
    return response.ok;
  } catch (error) {
    console.error('Faucet request failed:', error);
    return false;
  }
}

// EIP-712 typed data structure for Yellow Network auth
// This must match the server's expected Policy structure exactly
export function buildAuthTypedData(challenge: string, authParams: AuthParams) {
  return {
    domain: {
      name: authParams.application, // Application name from auth_request
    },
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' }
      ],
      Policy: [
        { name: 'challenge', type: 'string' },
        { name: 'scope', type: 'string' },
        { name: 'wallet', type: 'address' },
        { name: 'session_key', type: 'address' },
        { name: 'expires_at', type: 'uint64' },
        { name: 'allowances', type: 'Allowance[]' }
      ],
      Allowance: [
        { name: 'asset', type: 'string' },
        { name: 'amount', type: 'string' }
      ]
    },
    primaryType: 'Policy' as const,
    message: {
      challenge,
      scope: authParams.scope,
      wallet: authParams.address,
      session_key: authParams.session_key,
      expires_at: authParams.expires_at,
      allowances: authParams.allowances
    },
  };
}
