import { TokenProgramService } from '@coin98/solana-support-library';
import { Connection } from '@solana/web3.js';
import BN from 'bn.js';
import { PoolInfo } from './saros_swap.instruction';
import {
  OWNER_TRADING_FEE_DENOMINATOR,
  OWNER_TRADING_FEE_NUMERATOR,
  OWNER_WITHDRAW_FEE_DENOMINATOR,
  OWNER_WITHDRAW_FEE_NUMERATOR,
  TRADING_FEE_DENOMINATOR,
  TRADING_FEE_NUMERATOR
} from './saros_swap_constant';

const PRECISION_DEFAULT = 1000000000;
const PRECISION_DEFAULT_BN = new BN(PRECISION_DEFAULT);

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
    return applyLowerSlippage(lpAmount, slippage);
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
      applyUpperSlippage(token0Amount, slippage),
      applyUpperSlippage(token1Amount, slippage),
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
    return applyUpperSlippage(lpAmount, slippage);
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
      applyLowerSlippage(token0Amount, slippage),
      applyLowerSlippage(token1Amount, slippage),
    ];
  }

  // WITHDRAW SINGLE-SIDED
  calcLpTokenAmountForWithdrawToken0(
    tokenAmount: BN,
    slippage: number,
  ): BN {
    const poolInfo = this._poolInfo;
    return this.calcLpTokenAmountForWithdrawTokenX(
      tokenAmount,
      poolInfo.token0Amount,
      poolInfo.lpTokenSupply,
      slippage,
    );
  }

  calcLpTokenAmountForWithdrawToken1(
    tokenAmount: BN,
    slippage: number,
  ): BN {
    const poolInfo = this._poolInfo;
    return this.calcLpTokenAmountForWithdrawTokenX(
      tokenAmount,
      poolInfo.token1Amount,
      poolInfo.lpTokenSupply,
      slippage,
    );
  }

  private calcLpTokenAmountForWithdrawTokenX(
    tokenAmount: BN,
    poolTokenAmount: BN,
    lpTokenSupply: BN,
    slippage: number,
  ): BN {
    const poolInfo = this._poolInfo;
    const [tradeFeeN, tradeFeeD] = getTradingFee(poolInfo);
    const tokenAmountWithFee = includeFee(tokenAmount, tradeFeeN, tradeFeeD.muln(2)); // Only calculate fee for half amount
    const tokenProportion = (
      tokenAmountWithFee.mul(PRECISION_DEFAULT_BN)
        .div(poolTokenAmount)
        .toNumber()
      ) / PRECISION_DEFAULT;
    const withdrawProportion = 1 - Math.sqrt(1 - tokenProportion);
    const lpTokenAmount = lpTokenSupply.muln(withdrawProportion);
    const [withdrawalFeeN, withdrawalFeeD] = getProtocolWithdrawalFee(poolInfo);
    const lpTokenAmountWithFee = includeFee(lpTokenAmount, withdrawalFeeN, withdrawalFeeD);
    const maxLpTokenAmount = applyUpperSlippage(lpTokenAmountWithFee, slippage);
    return maxLpTokenAmount;
  }

  calcTokenAmountForWithdrawToken0(
    lpTokenAmount: BN,
    slippage: number,
  ): BN {
    const poolInfo = this._poolInfo;
    return this.calcTokenAmountForWithdrawTokenX(
      lpTokenAmount,
      poolInfo.token0Amount,
      poolInfo.lpTokenSupply,
      slippage,
    );
  }

  calcTokenAmountForWithdrawToken1(
    lpTokenAmount: BN,
    slippage: number,
  ): BN {
    const poolInfo = this._poolInfo;
    return this.calcTokenAmountForWithdrawTokenX(
      lpTokenAmount,
      poolInfo.token1Amount,
      poolInfo.lpTokenSupply,
      slippage,
    );
  }

  private calcTokenAmountForWithdrawTokenX(
    lpTokenAmount: BN,
    poolTokenAmount: BN,
    lpTokenSupply: BN,
    slippage: number,
  ): BN {
    const poolInfo = this._poolInfo;
    const [withdrawalFeeN, withdrawalFeeD] = getProtocolWithdrawalFee(poolInfo);
    const lpTokenAmountWithoutFee = excludeFee(lpTokenAmount, withdrawalFeeN, withdrawalFeeD);
    const lpTokenProportion = (
      lpTokenAmountWithoutFee.mul(PRECISION_DEFAULT_BN)
        .div(lpTokenSupply)
        .toNumber()
      ) / PRECISION_DEFAULT;
    const withdrawProportion = 1 - Math.pow(1 - lpTokenProportion, 2);
    const tokenAmount = new BN(withdrawProportion * PRECISION_DEFAULT)
      .mul(poolTokenAmount)
      .div(PRECISION_DEFAULT_BN);
    const [tradeFeeN, tradeFeeD] = getTradingFee(poolInfo);
    const tokenAmountWithoutFee = excludeFee(tokenAmount, tradeFeeN, tradeFeeD.muln(2)); // Only calculate fee for half amount
    const minTokenAmount = applyLowerSlippage(tokenAmountWithoutFee, slippage);
    return minTokenAmount;
  }

  // SHARE
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
}

function applyLowerSlippage(
  amount: BN,
  slippage: number,
): BN {
  if(slippage > 0) {
    return amount.muln(10000 - slippage).divn(10000);
  }
  return amount;
}

function applyUpperSlippage(
  amount: BN,
  slippage: number,
): BN {
  if(slippage > 0) {
    return amount.muln(10000 + slippage).divn(10000);
  }
  return amount;
}

function includeFee(
  preFeeAmount: BN,
  feeNumerator: BN,
  feeDenominator: BN
): BN {
  if(feeNumerator.eqn(0)) {
    return preFeeAmount;
  }
  let fee = preFeeAmount.mul(feeNumerator)
    .div(feeDenominator);
  if(fee.eqn(0)) {
    fee = new BN('1');
  }
  return preFeeAmount.add(fee);
}

function excludeFee(
  postFeeAmount: BN,
  feeNumerator: BN,
  feeDenominator: BN
): BN {
  if(feeNumerator.eqn(0)) {
    return postFeeAmount;
  }
  let fee = postFeeAmount.mul(feeNumerator)
    .div(feeDenominator);
  if(fee.eqn(0)) {
    fee = new BN('1');
  }
  return postFeeAmount.sub(fee);
}

function ceil(
  orignalNumber: BN,
  decimal: number,
): BN {
  if(decimal == 0) {
    return orignalNumber;
  }
  const precision = Math.pow(10, decimal);
  const mod = orignalNumber.modrn(precision);
  return orignalNumber.divn(precision).addn(mod == 0 ? 0: 1);
}

function floor(
  orignalNumber: BN,
  decimal: number,
): BN {
  if(decimal == 0) {
    return orignalNumber;
  }
  const precision = Math.pow(10, decimal);
  return orignalNumber.divn(precision);
}

function getTradingFee(
  _poolInfo: PoolInfo,
): [BN, BN] {
  return [TRADING_FEE_NUMERATOR, TRADING_FEE_DENOMINATOR];
}

function getProtocolTradingFee(
  _poolInfo: PoolInfo,
): [BN, BN] {
  return [OWNER_TRADING_FEE_NUMERATOR, OWNER_TRADING_FEE_DENOMINATOR];
}

function getProtocolWithdrawalFee(
  _poolInfo: PoolInfo,
): [BN, BN] {
  return [OWNER_WITHDRAW_FEE_NUMERATOR, OWNER_WITHDRAW_FEE_DENOMINATOR];
}
