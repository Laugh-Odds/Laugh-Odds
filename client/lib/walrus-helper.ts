import axios from "axios";

const AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";
const PUBLISHER = "https://publisher.walrus-testnet.walrus.space";

const axiosAggregator = axios.create({
  baseURL: AGGREGATOR,
});

const axiosPublisher = axios.create({
  baseURL: PUBLISHER,
});

type TAlreadyCertified = {
  alreadyCertified: {
    blobId: string;
    endEpoch: number;
    eventOrObject: {
      Event: {
        eventSeq: string;
        txDigest: string;
      };
    };
  };
};

type TNewlyCertified = {
  newlyCreated: {
    blobObject: {
      blobId: string;
      certifiedEpoch: number;
      deletable: boolean;
      encodingType: string;
      id: string;
      registeredEpoch: number;
      size: number;
      storage: {
        endEpoch: number;
        id: string;
        startEpoch: number;
        storageSize: number;
      };
    };
    cost: number;
    resourceOperation: {
      RegisterFromScratch: {
        encoded_length: number;
        epochs_ahead: number;
      };
    };
  };
};

export async function storeFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axiosPublisher.put("/v1/store", file, {
    headers: {
      "Content-Type": file.type,
    },
  });

  console.log(response.data);

  return response.data as TAlreadyCertified | TNewlyCertified;
}

export async function downloadBlob(blobId: string) {
  const response = await axiosAggregator.get(`/v1/${blobId}`, {
    responseType: "blob",
  });

  const blob = new Blob([response.data], { type: "image/*" });

  return blob;
}
