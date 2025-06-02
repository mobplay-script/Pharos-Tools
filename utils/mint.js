const { ethers } = require("ethers");
const settings = require("../config/config");

const EXPOLER = `${settings.EXPOLER}/tx/`;

class MintService {
  constructor({ wallet, provider }) {
    this.wallet = wallet;
    this.provider = provider;
  }
  async mintGotChip() {
    try {
      const wallet = this.wallet;
      const provider = this.provider;
      const balance = await provider.getBalance(wallet.address);

      const balanceInEther = ethers.formatEther(balance);

      if (parseFloat(balanceInEther) < 0.0005) {
        return {
          tx: null,
          success: false,
          stop: true,
          message: "Insufficient PHRS for mint",
        };
      }

      const pendingNonce = await provider.getTransactionCount(wallet.address, "pending");
      const latestNonce = await provider.getTransactionCount(wallet.address, "latest");

      if (pendingNonce > latestNonce) {
        return {
          tx: null,
          success: false,
          stop: false,
          message: "There are pending transactions. Please wait for them to be completed.",
        };
      }

      const params = {
        to: "0x0000000038f050528452d6da1e7aacfa7b3ec0a8",
        data: "0x5b70ea9f",
        gasPrice: ethers.parseUnits("1.3", "gwei"),
        gasLimit: 286314,
        chainId: settings.CHAIN_ID,
        nonce: latestNonce,
        value: 0,
      };

      const tx = await wallet.sendTransaction(params);
      await tx.wait(3);

      return {
        tx: tx.hash,
        success: true,
        message: `Mint successful! Transaction hash: ${EXPOLER}${tx.hash}`,
      };
    } catch (error) {
      return {
        tx: null,
        success: false,
        stop: true,
        message: `Error mint: ${error.message}`,
      };
    }
  }
}

module.exports = MintService;
