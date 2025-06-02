const { ethers } = require("ethers");

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)",
  "function deposit() payable returns ()",
  "function withdraw(uint256 wad) returns ()",
];

async function checkBalance({ address: tokenAddress, provider, wallet }) {
  try {
    if (tokenAddress) {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
      const balance = await tokenContract.balanceOf(wallet.address);
      const decimals = 18;
      return parseFloat(ethers.formatUnits(balance, decimals)).toFixed(4);
    } else {
      const balance = await provider.getBalance(wallet.address);
      return parseFloat(ethers.formatEther(balance)).toFixed(4);
    }
  } catch (error) {
    console.log(`[${wallet.address}] Failed to check balance: ${error.message}`);
    return "0";
  }
}

module.exports = { checkBalance };
