import { Connection } from '@solana/web3.js';
import { PoolInfo } from './saros_swap.instruction';
import BN from 'bn.js';
import { TokenProgramService } from '@coin98/solana-support-library';

export enum TradeDirection {
  AtoB,
  BtoA,
}

export class SarosSwapCalculator {

  private _poolInfo: PoolInfo;

  constructor(poolInfo: PoolInfo) {
    this._poolInfo = poolInfo;
  }

  // DEPOSITS
  calcLpTokenAmountForDepositAllTypes(
    token0Amount: BN,
    token1Amount: BN,
    slippage: number,
  ): BN {
    const poolInfo = this._poolInfo;
    const token0LpEquivalent = token0Amount.mul(poolInfo.lpTokenSupply)
      .div(poolInfo.token0Amount);
    const token1LpEquivalent = token1Amount.mul(poolInfo.lpTokenSupply)
      .div(poolInfo.token1Amount);
    let lpAmount = BN.min(token0LpEquivalent, token1LpEquivalent);
    return this.applyLowerSlippage(lpAmount, slippage);
  }

  calcTokenAmountsForDepositAllTypes(
    lpTokenAmount: BN,
    slippage: number,
  ): [BN, BN] {
    const poolInfo = this._poolInfo;
    const token0Amount = lpTokenAmount.mul(poolInfo.token0Amount)
      .div(poolInfo.lpTokenSupply);
    const token1Amount = lpTokenAmount.mul(poolInfo.token1Amount)
      .div(poolInfo.lpTokenSupply);
    return [
      this.applyUpperSlippage(token0Amount, slippage),
      this.applyUpperSlippage(token1Amount, slippage),
    ];
  }

  // WITHDRAWAL
  calcLpTokenAmountForWithdrawAllTypes(
    token0Amount: BN,
    token1Amount: BN,
    slippage: number,
  ): BN {
    const poolInfo = this._poolInfo;
    const token0LpEquivalent = token0Amount.mul(poolInfo.lpTokenSupply)
      .div(poolInfo.token0Amount);
    const token1LpEquivalent = token1Amount.mul(poolInfo.lpTokenSupply)
      .div(poolInfo.token1Amount);
    let lpAmount = BN.min(token0LpEquivalent, token1LpEquivalent);
    return this.applyUpperSlippage(lpAmount, slippage);
  }

  calcTokenAmountsForWithdrawAllTypes(
    lpTokenAmount: BN,
    slippage: number,
  ): [BN, BN] {
    const poolInfo = this._poolInfo;
    const token0Amount = lpTokenAmount.mul(poolInfo.token0Amount)
      .div(poolInfo.lpTokenSupply);
    const token1Amount = lpTokenAmount.mul(poolInfo.token1Amount)
      .div(poolInfo.lpTokenSupply);
    return [
      this.applyLowerSlippage(token0Amount, slippage),
      this.applyLowerSlippage(token1Amount, slippage),
    ];
  }

  calcLpTokenAmountFromToken0(
    tokenAmount: BN,
  ): BN {
    const poolInfo = this._poolInfo;
    return tokenAmount.mul(poolInfo.lpTokenSupply)
      .div(poolInfo.token0Amount);
  }

  calcLpTokenAmountFromToken1(
    tokenAmount: BN
  ): BN {
    const poolInfo = this._poolInfo;
    return tokenAmount.mul(poolInfo.lpTokenSupply)
      .div(poolInfo.token1Amount);
  }

  async sync(
    connection: Connection
  ): Promise<void> {
    const poolInfo = this._poolInfo;
    const poolLpMintInfo = await TokenProgramService.getTokenMintInfo(
      connection,
      poolInfo.lpTokenMint,
    );
    poolInfo.lpTokenSupply = poolLpMintInfo.supply;

    const poolToken0AccountInfo = await TokenProgramService.getTokenAccountInfo(
      connection,
      poolInfo.token0Account,
    );
    poolInfo.token0Amount = poolToken0AccountInfo.amount;

    const poolToken1AccountInfo = await TokenProgramService.getTokenAccountInfo(
      connection,
      poolInfo.token1Account,
    );
    poolInfo.token1Amount = poolToken1AccountInfo.amount;
  }

  async update(poolInfo: PoolInfo) {
    this._poolInfo = poolInfo;
  }

  private applyLowerSlippage(
    amount: BN,
    slippage: number,
  ): BN {
    if(slippage > 0) {
      return amount.muln(10000 - slippage).divn(10000);
    }
    return amount;
  }

  private applyUpperSlippage(
    amount: BN,
    slippage: number,
  ): BN {
    if(slippage > 0) {
      return amount.muln(10000 + slippage).divn(10000);
    }
    return amount;
  }
}
