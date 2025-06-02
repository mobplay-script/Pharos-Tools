const { ethers } = require("ethers");
const settings = require("../config/config");

const EXPOLER = `${settings.EXPOLER}/tx/`;

class TransferService {
  constructor({ wallet, provider }) {
    this.wallet = wallet;
    this.provider = provider;
  }
  async sendToken({ recipientAddress, amount }) {
    try {
      const wallet = this.wallet;
      const provider = this.provider;
      const amountIn = ethers.parseEther(amount.toString());
      const balance = await provider.getBalance(wallet.address);

      const balanceInEther = ethers.formatEther(balance);

      if (parseFloat(balanceInEther) < parseFloat(amount) + 0.0005) {
        return {
          tx: null,
          success: false,
          stop: true,
          message: "Insufficient PHRS for transfer",
        };
      }

      const minBalance = amountIn + ethers.parseEther("0.000021");
      if (balance < minBalance) {
        return {
          tx: null,
          success: false,
          stop: false,
          message: `Insufficient PHRS. Need at least ${ethers.formatEther(minBalance)} PHRS, have ${ethers.formatEther(balance)} PHRS.`,
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

      const tx = await wallet.sendTransaction({
        to: recipientAddress,
        value: amountIn,
        gasLimit: 21000,
        nonce: latestNonce,
      });
      await tx.wait(3);

      return {
        tx: tx.hash,
        success: true,
        message: `Send ${amount} PHRS successful! Transaction hash: ${EXPOLER}${tx.hash}`,
      };
    } catch (error) {
      if (error.code === "NONCE_EXPIRED" || error.message.includes("TX_REPLAY_ATTACK")) {
        return {
          tx: null,
          success: false,
          stop: false,
          message: "Nonce conflict detected. Please retry the transaction.",
        };
      }
      return {
        tx: null,
        success: false,
        stop: true,
        message: `Error Send: ${error.message}`,
      };
    }
  }
}

module.exports = TransferService;
