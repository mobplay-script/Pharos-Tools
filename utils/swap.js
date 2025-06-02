const { ethers } = require("ethers");
const settings = require("../config/config");
const { getRandomNumber } = require("./utils");

const EXPOLER = "https://testnet.pharosscan.xyz/tx/";
const CHAIN_ID = 688688;

const WPHRS_ADDRESS = "0x76aaada469d23216be5f7c596fa25f282ff9b364";
const USDC_ADDRESS = "0xad902cf99c2de2f1ba5ec4d642fd7e49cae9ee37";
const USDT_ADDRESS = "0xed59de2d7ad9c043442e381231ee3646fc3c2939";
const POSITIONMANAGER_ADDRESS = "0xF8a1D4FF0f9b9Af7CE58E1fc1833688F3BFd6115";
const FACTORY = "0x7CE5b44F2d05babd29caE68557F52ab051265F01";
const QUOTER = "0x00f2f47d1ed593Cf0AF0074173E9DF95afb0206C";
const SWAP_ROUTER_ADDRESS = "0x1a4de519154ae51200b0ad7c90f7fac75547888a";
const USDC_POOL_ADDRESS = "0x0373a059321219745aee4fad8a942cf088be3d0e";
const USDT_POOL_ADDRESS = "0x70118b6eec45329e0534d849bc3e588bb6752527";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)",
  "function deposit() payable returns ()",
  "function withdraw(uint256 wad) returns ()",
  "function multicall(uint256, bytes[]) public payable returns (bytes[] memory)",
  "function exactInputSingle((address,address,uint24,address,uint256,uint256,uint160)) external payable returns (uint256)",
];

const pairOptions = [
  { id: 1, from: "WPHRS", to: "USDC" },
  { id: 2, from: "USDC", to: "WPHRS" },
  { id: 3, from: "WPHRS", to: "USDT" },
  { id: 4, from: "USDT", to: "WPHRS" },
];
const tokenDecimals = {
  WPHRS: 18,
  USDC: 18,
  USDT: 18,
};

const tokens = {
  USDC: "0xad902cf99c2de2f1ba5ec4d642fd7e49cae9ee37",
  USDT: "0xed59de2d7ad9c043442e381231ee3646fc3c2939",
  WPHRS: "0x76aaada469d23216be5f7c596fa25f282ff9b364",
};

class SwapService {
  constructor({ wallet, log, provider }) {
    this.wallet = wallet;
    this.log = log;
    this.provider = provider;
  }

  checkBalanceAndApproval = async (tokenAddress, amount, decimals, spender) => {
    const wallet = this.wallet;
    const provider = this.provider;
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    try {
      const symbol = Object.entries(tokens).find((item) => item[1] === tokenAddress)[0];
      const balance = await tokenContract.balanceOf(wallet.address);
      const required = ethers.parseUnits(amount.toString(), decimals);

      if (balance < required) {
        return {
          tx: null,
          success: false,
          stop: false,
          message: `Insufficient ${symbol} balance: ${ethers.formatUnits(balance, decimals)} < ${amount}`,
        };
      }

      const allowance = await tokenContract.allowance(wallet.address, spender);
      if (allowance < required) {
        const approveTx = await tokenContract.approve(spender, required);
        await approveTx.wait();
      }

      return {
        tx: null,
        success: true,
        message: `200`,
      };
    } catch (error) {
      if (error.message.includes("TX_REPLAY_ATTACK")) {
        this.log("Retrying with incremented nonce...");
        const nonce = (await wallet.provider.getTransactionCount(wallet.address, "latest")) + 1;
        const tx = await tokenContract.approve(spenderAddress, amount, { nonce });
        await tx.wait();
        return true;
      }
      return {
        tx: null,
        success: false,
        stop: true,
        message: `Balance/approval check failed: ${error.message}`,
      };
    }
  };

  getExactInputSingleData({ tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96 }) {
    return new ethers.Interface([
      "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
    ]).encodeFunctionData("exactInputSingle", [
      {
        tokenIn,
        tokenOut,
        fee,
        recipient,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96,
      },
    ]);
  }

  async swapToken(params) {
    const wallet = this.wallet;
    const provider = this.provider;
    const { amount: amountIn, pairsInit } = params;
    try {
      const options = pairsInit ? pairsInit : pairOptions;
      const pair = options[Math.floor(Math.random() * options.length)];
      const decimals = tokenDecimals[pair.from];
      const tokenContract = new ethers.Contract(tokens[pair.from], ERC20_ABI, provider);

      const balance = await tokenContract.balanceOf(wallet.address);
      const amountStableCoinToSwap = ethers.formatUnits((balance * 80n) / 100n, decimals);
      const amount = pair.from === "WPHRS" ? amountIn.toString() : Number(amountStableCoinToSwap).toFixed(4);
      const required = ethers.parseUnits(amount.toString(), decimals);

      this.log(`Swapping ${amount} ${pair.from} to ${pair.to}`.blue);

      if (balance < required) {
        if (pair.from !== "WPHRS") {
          return await this.swapToken({
            ...params,
            pairsInit: [
              { id: 1, from: "WPHRS", to: "USDC" },
              { id: 3, from: "WPHRS", to: "USDT" },
            ],
          });
        } else {
          const balanceNative = await provider.getBalance(wallet.address);
          if (balanceNative > required) {
            await this.wrapToken({ ...params, action: "wrap" });
            return await this.swapToken({
              ...params,
            });
          } else
            return {
              tx: null,
              success: false,
              stop: false,
              message: `Insufficient ${pair.from} balance: ${ethers.formatUnits(balance, decimals)} < ${amount}`,
            };
        }
      }

      const res = await this.checkBalanceAndApproval(tokens[pair.from], amount, decimals, SWAP_ROUTER_ADDRESS);

      if (!res.success) {
        return {
          tx: null,
          success: false,
          stop: false,
          message: res.message,
        };
      }
      const value = ethers.parseEther(amount);

      try {
        const exactInputSingleData = this.getExactInputSingleData({
          tokenIn: tokens[pair.from],
          tokenOut: tokens[pair.to],
          fee: 500,
          recipient: wallet.address,
          amountIn: value,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        });

        const deadline = Math.floor(Date.now() / 1000) + 600 * 20;

        let gasLimit = 179000;
        try {
          gasLimit = await router.multicall.estimateGas(deadline, [exactInputData]);
          gasLimit = Math.ceil(Number(gasLimit) * 1.2);
        } catch (e) {}

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
        const router = new ethers.Contract(SWAP_ROUTER_ADDRESS, ERC20_ABI, wallet);
        const tx = await router.multicall(deadline, [exactInputSingleData], { gasLimit });
        await tx.wait();

        return {
          tx: tx.hash,
          success: true,
          message: `Swap ${amount} ${pair.from} to ${pair.to} success: ${EXPOLER}${tx.hash}`,
        };
      } catch (error) {
        if (error.code === "NONCE_EXPIRED" || error.message.includes("TX_REPLAY_ATTACK")) {
          return {
            tx: null,
            success: false,
            stop: true,
            message: "Nonce conflict detected. Please retry the transaction.",
          };
        }
        return {
          tx: null,
          success: false,
          stop: false,
          message: `Swap ${amount} ${pair.from} to ${pair.to} failed for: ${error.message}`,
        };
      }
    } catch (error) {
      return {
        tx: null,
        success: false,
        stop: false,
        message: `Error swap: ${error.message}`,
      };
    }
  }

  async wrapToken(params) {
    let { action, amount, wallet, balance } = params;
    amount = Number(amount) * 2;
    try {
      if (balance < ethers.parseEther("0.0001")) {
        return {
          tx: null,
          success: false,
          stop: false,
          message: `Insufficient PHRS for wrap WPHRS`,
        };
      }

      const contract = new ethers.Contract(WPHRS_ADDRESS, ERC20_ABI, wallet);

      const amountWei = ethers.parseEther(amount.toString());
      let tx;

      if (action === "wrap") {
        tx = await contract.deposit({
          value: amountWei,
          gasLimit: 44866,
        });
      } else {
        tx = await contract.withdraw(amountWei, {
          gasLimit: 35116,
        });
      }
      await tx.wait(3);
      return {
        tx: tx.hash,
        success: true,
        message: `Swap ${amount} success: ${EXPOLER}${tx.hash}`,
      };
    } catch (error) {
      return {
        tx: tx.hash,
        success: true,
        message: `Swap ${amount} failed: ${error.message}`,
      };
    }
  }
}

module.exports = SwapService;
