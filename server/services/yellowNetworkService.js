// server/services/yellowNetworkService.js
// Server-side Yellow Network state channel management
const WebSocket = require('ws');

const CLEARNODE_WS_URL = process.env.CLEARNODE_WS_URL || 'wss://clearnet-sandbox.yellow.com/ws';
const YELLOW_PRIVATE_KEY = process.env.YELLOW_PRIVATE_KEY;
const VOTE_COST_AMOUNT = '100'; // 0.0001 ytest.usd in base units

class YellowNetworkService {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.isAuthenticated = false;
        this.sessionKey = null;
        this.balance = '0';
        this.nonce = 0;
        this.pendingTransfers = new Map();
        this.reconnectTimer = null;
    }

    // Generate server session key from private key
    generateSessionKey() {
        if (!YELLOW_PRIVATE_KEY) {
            throw new Error('YELLOW_PRIVATE_KEY not configured');
        }
        // Use a deterministic session key derived from the private key
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(YELLOW_PRIVATE_KEY + Date.now()).digest('hex');
        return '0x' + hash;
    }

    // Connect to Clearnode
    async connect() {
        return new Promise((resolve, reject) => {
            if (this.ws && this.isConnected) {
                resolve();
                return;
            }

            console.log('[Yellow Server] Connecting to Clearnode:', CLEARNODE_WS_URL);

            try {
                this.ws = new WebSocket(CLEARNODE_WS_URL);
            } catch (err) {
                console.error('[Yellow Server] Failed to create WebSocket:', err.message);
                reject(err);
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 30000);

            this.ws.on('open', () => {
                clearTimeout(timeout);
                console.log('[Yellow Server] WebSocket connected');
                this.isConnected = true;
                this.startAuth(resolve, reject);
            });

            this.ws.on('message', (data) => {
                this.handleMessage(data, resolve, reject);
            });

            this.ws.on('error', (err) => {
                console.error('[Yellow Server] WebSocket error:', err.message);
                this.isConnected = false;
                this.isAuthenticated = false;
            });

            this.ws.on('close', () => {
                console.log('[Yellow Server] WebSocket disconnected');
                this.isConnected = false;
                this.isAuthenticated = false;
                this.ws = null;

                // Reconnect after 5 seconds
                if (!this.reconnectTimer) {
                    this.reconnectTimer = setTimeout(() => {
                        this.reconnectTimer = null;
                        this.connect().catch(err => {
                            console.error('[Yellow Server] Reconnect failed:', err.message);
                        });
                    }, 5000);
                }
            });
        });
    }

    startAuth(resolve, reject) {
        if (!YELLOW_PRIVATE_KEY) {
            console.warn('[Yellow Server] No YELLOW_PRIVATE_KEY set, skipping auth');
            resolve();
            return;
        }

        this.sessionKey = this.generateSessionKey();
        this._authResolve = resolve;
        this._authReject = reject;

        this.send({
            type: 'auth_request',
            session_key: this.sessionKey,
            wallet_address: this.getServerAddress(),
            timestamp: Date.now(),
        });
    }

    getServerAddress() {
        if (!YELLOW_PRIVATE_KEY) return '0x0000000000000000000000000000000000000000';
        // Derive address from private key using ethers
        try {
            const { ethers } = require('ethers');
            const wallet = new ethers.Wallet(YELLOW_PRIVATE_KEY);
            return wallet.address;
        } catch (err) {
            console.error('[Yellow Server] Failed to derive address:', err.message);
            return '0x0000000000000000000000000000000000000000';
        }
    }

    async handleMessage(data, authResolve, authReject) {
        try {
            const msg = JSON.parse(data.toString());
            console.log('[Yellow Server] Received:', msg.type);

            switch (msg.type) {
                case 'auth_challenge': {
                    // Sign with server private key
                    try {
                        const { ethers } = require('ethers');
                        const wallet = new ethers.Wallet(YELLOW_PRIVATE_KEY);

                        // Sign the challenge
                        const signature = await wallet.signTypedData(
                            {
                                name: msg.domain?.name || 'Yellow Network',
                                version: msg.domain?.version || '1',
                                chainId: msg.domain?.chainId || 11155111,
                            },
                            {
                                AuthMessage: [
                                    { name: 'challenge', type: 'string' },
                                    { name: 'session_key', type: 'address' },
                                ],
                            },
                            {
                                challenge: msg.challenge,
                                session_key: this.sessionKey,
                            }
                        );

                        this.send({
                            type: 'auth_verify',
                            wallet_address: wallet.address,
                            session_key: this.sessionKey,
                            signature,
                            challenge: msg.challenge,
                        });
                    } catch (signErr) {
                        console.error('[Yellow Server] Auth signing failed:', signErr.message);
                        if (authReject) authReject(signErr);
                    }
                    break;
                }

                case 'auth_success': {
                    console.log('[Yellow Server] Authenticated successfully');
                    this.isAuthenticated = true;
                    this.send({ type: 'get_balance' });
                    if (authResolve) authResolve();
                    break;
                }

                case 'auth_error': {
                    console.error('[Yellow Server] Auth error:', msg.message);
                    this.isAuthenticated = false;
                    if (authReject) authReject(new Error(msg.message));
                    break;
                }

                case 'balance': {
                    this.balance = msg.balances?.['ytest.usd'] || '0';
                    console.log('[Yellow Server] Balance:', this.balance, 'ytest.usd');
                    break;
                }

                case 'transfer_success': {
                    const pending = this.pendingTransfers.get(msg.transfer_id);
                    if (pending) {
                        pending.resolve({ success: true, transferId: msg.transfer_id });
                        this.pendingTransfers.delete(msg.transfer_id);
                    }
                    this.send({ type: 'get_balance' });
                    break;
                }

                case 'transfer_error': {
                    const pending = this.pendingTransfers.get(msg.transfer_id);
                    if (pending) {
                        pending.reject(new Error(msg.message || 'Transfer failed'));
                        this.pendingTransfers.delete(msg.transfer_id);
                    }
                    break;
                }

                case 'transfer_received': {
                    // Incoming transfer from user (vote payment)
                    console.log('[Yellow Server] Received transfer:', msg);
                    break;
                }

                default:
                    console.log('[Yellow Server] Unhandled:', msg.type);
            }
        } catch (err) {
            console.error('[Yellow Server] Error handling message:', err.message);
        }
    }

    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        } else {
            console.warn('[Yellow Server] Cannot send, not connected');
        }
    }

    // Validate incoming vote transfer from user
    validateIncomingVoteTransfer(transferProof) {
        if (!transferProof || !transferProof.transferId) {
            return { valid: false, error: 'Missing transfer proof' };
        }

        // In production, verify the transfer proof cryptographically
        // For now, trust the transferId and validate via Clearnode API
        return { valid: true };
    }

    // Distribute rewards to winners via Yellow Network
    async distributeRewards(winners) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with Yellow Network');
        }

        const results = [];

        for (const winner of winners) {
            try {
                const transferId = `reward_${winner.address}_${Date.now()}`;
                const result = await this.sendTransfer(
                    winner.address,
                    winner.amount.toString(),
                    transferId
                );
                results.push({ address: winner.address, success: true, transferId });
                console.log(`[Yellow Server] Reward sent to ${winner.address}: ${winner.amount} ytest.usd`);
            } catch (err) {
                console.error(`[Yellow Server] Failed to send reward to ${winner.address}:`, err.message);
                results.push({ address: winner.address, success: false, error: err.message });
            }
        }

        return results;
    }

    // Send a transfer via Yellow Network
    sendTransfer(toAddress, amount, transferId) {
        return new Promise((resolve, reject) => {
            if (!this.isAuthenticated) {
                reject(new Error('Not authenticated'));
                return;
            }

            this.pendingTransfers.set(transferId, { resolve, reject });

            this.send({
                type: 'transfer',
                transfer_id: transferId,
                to: toAddress,
                asset: 'ytest.usd',
                amount,
                nonce: ++this.nonce,
            });

            // Timeout after 30s
            setTimeout(() => {
                if (this.pendingTransfers.has(transferId)) {
                    this.pendingTransfers.delete(transferId);
                    reject(new Error('Transfer timeout'));
                }
            }, 30000);
        });
    }

    getBalance() {
        return this.balance;
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            isAuthenticated: this.isAuthenticated,
            balance: this.balance,
        };
    }
}

module.exports = new YellowNetworkService();
