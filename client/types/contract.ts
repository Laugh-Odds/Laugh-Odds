// client/types/contract.ts - Create this new file
export interface Meme {
  creator: string;
  cid: string;
  memeTemplate: number;
}

export interface MarketData {
  0: string;      // creator address
  1: bigint;      // endTime
  2: bigint;      // yesVotes
  3: bigint;      // noVotes
  4: bigint;      // totalStaked
  5: boolean;     // isActive
  6: string;      // metadata
  7: Meme[];      // memes array
}

// Alternative tuple type
export type MarketDataTuple = [
  string,   // creator
  bigint,   // endTime
  bigint,   // yesVotes
  bigint,   // noVotes
  bigint,   // totalStaked
  boolean,  // isActive
  string,   // metadata
  Meme[]    // memes
];