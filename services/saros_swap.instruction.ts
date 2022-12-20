import {
  BorshService,
  TOKEN_PROGRAM_ID
} from '@coin98/solana-support-library';
import * as borsh from '@project-serum/borsh';
import {
  AccountMeta,
  PublicKey,
  TransactionInstruction
} from '@solana/web3.js';
import BN from 'bn.js';
import * as BufferLayout from 'buffer-layout';

export const INITIALIZE_POOL_SPAN = 324;

export class PoolInfo {
  address: PublicKey
  version: number
  state: number
  nonce: number
  tokenProgramId: PublicKey
  lpTokenMint: PublicKey
  lpTokenSupply?: BN
  feeAccount: PublicKey
  token0Mint: PublicKey
  token0Account: PublicKey
  token0Amount?: BN
  token1Mint: PublicKey
  token1Account: PublicKey
  token1Amount?: BN
  tradeFeeNumerator: BN
  tradeFeeDenominator: BN
  ownerTradeFeeNumerator: BN
  ownerTradeFeeDenominator: BN
  ownerWithdrawFeeNumerator: BN
  ownerWithdrawFeeDenominator: BN
  hostFeeNumerator: BN
  hostFeeDenominator: BN
  curveType: number
  curveParameters: number[]
}

interface PoolData {
  version: number
  state: number
  bumpSeed: number
  tokenProgramId: PublicKey
  tokenAccountA: PublicKey
  tokenAccountB: PublicKey
  tokenPool: PublicKey
  mintA: PublicKey
  mintB: PublicKey
  feeAccount: PublicKey
  tradeFeeNumerator: BN
  tradeFeeDenominator: BN
  ownerTradeFeeNumerator: BN
  ownerTradeFeeDenominator: BN
  ownerWithdrawFeeNumerator: BN
  ownerWithdrawFeeDenominator: BN
  hostFeeNumerator: BN
  hostFeeDenominator: BN
  curveType: number
  curveParameters: number[]
}

export const CurveType = Object.freeze({
  ConstantProduct: 0, // Constant product curve, Uniswap-style
  ConstantPrice: 1, // Constant price curve, always X amount of A token for 1 B token, where X is defined at init
  Offset: 3, // Offset curve, like Uniswap, but with an additional offset on the token B side
})

const TokenSwapLayout = borsh.struct([
  borsh.u8('version'),
  borsh.u8('state'),
  borsh.u8('bumpSeed'),
  borsh.publicKey('tokenProgramId'),
  borsh.publicKey('tokenAccountA'),
  borsh.publicKey('tokenAccountB'),
  borsh.publicKey('tokenPool'),
  borsh.publicKey('mintA'),
  borsh.publicKey('mintB'),
  borsh.publicKey('feeAccount'),
  borsh.u64('tradeFeeNumerator'),
  borsh.u64('tradeFeeDenominator'),
  borsh.u64('ownerTradeFeeNumerator'),
  borsh.u64('ownerTradeFeeDenominator'),
  borsh.u64('ownerWithdrawFeeNumerator'),
  borsh.u64('ownerWithdrawFeeDenominator'),
  borsh.u64('hostFeeNumerator'),
  borsh.u64('hostFeeDenominator'),
  borsh.u8('curveType'),
  borsh.array(borsh.u8(), 32, 'curveParameters'),
]);

export class SarosSwapInstructionService {

  static createPool(
    poolAddress: PublicKey,
    poolToken0Address: PublicKey,
    poolToken1Address: PublicKey,
    poolLpTokenMintAddress: PublicKey,
    protocolFeeLpTokenAddress: PublicKey,
    userLpTokenAddress: PublicKey,
    tradeFeeNumerator: BN,
    tradeFeeDenominator: BN,
    ownerTradeFeeNumerator: BN,
    ownerTradeFeeDenominator: BN,
    ownerWithdrawFeeNumerator: BN,
    ownerWithdrawFeeDenominator: BN,
    hostFeeNumerator: BN,
    hostFeeDenominator: BN,
    curveType: number,
    curveParameters: BN,
    sarosSwapProgramId: PublicKey,
  ): TransactionInstruction {
    const dataLayout = borsh.struct([
      borsh.u8('instruction'),
      borsh.u64('tradeFeeNumerator'),
      borsh.u64('tradeFeeDenominator'),
      borsh.u64('ownerTradeFeeNumerator'),
      borsh.u64('ownerTradeFeeDenominator'),
      borsh.u64('ownerWithdrawFeeNumerator'),
      borsh.u64('ownerWithdrawFeeDenominator'),
      borsh.u64('hostFeeNumerator'),
      borsh.u64('hostFeeDenominator'),
      borsh.u8('curveType'),
      BufferLayout.blob(32, 'curveParameters'),
    ]);
    let curveParamsBuffer = Buffer.alloc(32);
    curveParameters.toArrayLike(Buffer).copy(curveParamsBuffer);
    const request = {
      instruction: 0, // InitializeSwap instruction
      tradeFeeNumerator,
      tradeFeeDenominator,
      ownerTradeFeeNumerator,
      ownerTradeFeeDenominator,
      ownerWithdrawFeeNumerator,
      ownerWithdrawFeeDenominator,
      hostFeeNumerator,
      hostFeeDenominator,
      curveType,
      curveParameters: curveParamsBuffer,
    };
    const data = BorshService.serialize(dataLayout, request, 1024);

    const [poolAuthorityAddress,] = this.findPoolAuthorityAddress(
      poolAddress,
      sarosSwapProgramId,
    );
    const keys: AccountMeta[] = [
      <AccountMeta>{ pubkey: poolAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: poolAuthorityAddress, isSigner: false, isWritable: false },
      <AccountMeta>{ pubkey: poolToken0Address, isSigner: false, isWritable: false },
      <AccountMeta>{ pubkey: poolToken1Address, isSigner: false, isWritable: false },
      <AccountMeta>{ pubkey: poolLpTokenMintAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: protocolFeeLpTokenAddress, isSigner: false, isWritable: false },
      <AccountMeta>{ pubkey: userLpTokenAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      data,
      keys,
      programId: sarosSwapProgramId,
    });
  }

  static swap(
    poolAddress: PublicKey,
    poolTokenInAddress: PublicKey,
    poolTokenOutAddress: PublicKey,
    poolLpTokenMintAddress: PublicKey,
    protocolLpTokenAddress: PublicKey,
    userDelegateAddress: PublicKey,
    userTokenInAddress: PublicKey,
    userTokenOutAddress: PublicKey,
    tokenInAmount: BN,
    minimumTokenOutAmount: BN,
    partnerLpTokenAddress: PublicKey | null,
    sarosSwapProgramId: PublicKey,
  ): TransactionInstruction {
    const dataLayout = borsh.struct([
      borsh.u8('instruction'),
      borsh.u64('amountIn'),
      borsh.u64('minimumAmountOut'),
    ]);
    const request = {
      instruction: 1, // Swap instruction
      amountIn: tokenInAmount,
      minimumAmountOut: minimumTokenOutAmount,
    };
    const data = BorshService.serialize(dataLayout, request, 128);

    const [poolAuthorityAddress,] = this.findPoolAuthorityAddress(
      poolAddress,
      sarosSwapProgramId,
    );
    const keys: AccountMeta[] = [
      <AccountMeta>{ pubkey: poolAddress, isSigner: false, isWritable: false },
      <AccountMeta>{ pubkey: poolAuthorityAddress, isSigner: false, isWritable: false },
      <AccountMeta>{ pubkey: userDelegateAddress, isSigner: true, isWritable: false },
      <AccountMeta>{ pubkey: userTokenInAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: poolTokenInAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: poolTokenOutAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: userTokenOutAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: poolLpTokenMintAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: protocolLpTokenAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];
    if (partnerLpTokenAddress !== null) {
      keys.push(<AccountMeta>{ pubkey: partnerLpTokenAddress, isSigner: false, isWritable: true });
    }

    return new TransactionInstruction({
      data,
      keys,
      programId: sarosSwapProgramId,
    });
  }

  static depositAllTokenTypes(
    poolAddress: PublicKey,
    poolToken0Address: PublicKey,
    poolToken1Address: PublicKey,
    poolLpTokenMintAddress: PublicKey,
    userDelegateAddress: PublicKey,
    userToken0Address: PublicKey,
    userToken1Address: PublicKey,
    userLpTokenAddress: PublicKey,
    lpTokenAmount: BN,
    maximumToken0Amount: BN,
    maximumToken1Amount: BN,
    sarosSwapProgramId: PublicKey,
  ): TransactionInstruction {
    const dataLayout = borsh.struct([
      borsh.u8('instruction'),
      borsh.u64('poolTokenAmount'),
      borsh.u64('maximumTokenA'),
      borsh.u64('maximumTokenB'),
    ]);
    const request = {
      instruction: 2, // Deposit instruction
      poolTokenAmount: lpTokenAmount,
      maximumTokenA: maximumToken0Amount,
      maximumTokenB: maximumToken1Amount,
    };
    const data = BorshService.serialize(dataLayout, request, 64);

    const [poolAuthorityAddress,] = this.findPoolAuthorityAddress(
      poolAddress,
      sarosSwapProgramId,
    );
    const keys: AccountMeta[] = [
      <AccountMeta>{ pubkey: poolAddress, isSigner: false, isWritable: false },
      <AccountMeta>{ pubkey: poolAuthorityAddress, isSigner: false, isWritable: false },
      <AccountMeta>{ pubkey: userDelegateAddress, isSigner: true, isWritable: false },
      <AccountMeta>{ pubkey: userToken0Address, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: userToken1Address, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: poolToken0Address, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: poolToken1Address, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: poolLpTokenMintAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: userLpTokenAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      data,
      keys,
      programId: sarosSwapProgramId,
    });
  }

  static withdrawAllTokenTypes(
    poolAddress: PublicKey,
    poolToken0Address: PublicKey,
    poolToken1Address: PublicKey,
    poolLpTokenMintAddress: PublicKey,
    protocolFeeLpTokenAddress: PublicKey,
    userDelegateAddress: PublicKey,
    userToken0Address: PublicKey,
    userToken1Address: PublicKey,
    userLpTokenAddress: PublicKey,
    lpTokenAmount: BN,
    minimumToken0Amount: BN,
    minimumToken1Amount: BN,
    sarosSwapProgramId: PublicKey,
  ): TransactionInstruction {
    const dataLayout = borsh.struct([
      borsh.u8('instruction'),
      borsh.u64('poolTokenAmount'),
      borsh.u64('minimumTokenA'),
      borsh.u64('minimumTokenB'),
    ]);
    const request = {
      instruction: 3, // Withdraw instruction
      poolTokenAmount: lpTokenAmount,
      minimumTokenA: minimumToken0Amount,
      minimumTokenB: minimumToken1Amount,
    };
    const data = BorshService.serialize(dataLayout, request, 64);

    const [poolAuthorityAddress,] = this.findPoolAuthorityAddress(
      poolAddress,
      sarosSwapProgramId,
    );
    const keys: AccountMeta[] = [
      <AccountMeta>{ pubkey: poolAddress, isSigner: false, isWritable: false },
      <AccountMeta>{ pubkey: poolAuthorityAddress, isSigner: false, isWritable: false },
      <AccountMeta>{ pubkey: userDelegateAddress, isSigner: true, isWritable: false },
      <AccountMeta>{ pubkey: poolLpTokenMintAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: userLpTokenAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: poolToken0Address, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: poolToken1Address, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: userToken0Address, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: userToken1Address, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: protocolFeeLpTokenAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      data,
      keys,
      programId: sarosSwapProgramId,
    });
  }

  static depositSingleTokenTypeExactAmountIn(
    poolAddress: PublicKey,
    poolToken0Address: PublicKey,
    poolToken1Address: PublicKey,
    poolLpTokenMintAddress: PublicKey,
    userDelegateAddress: PublicKey,
    userTokenInAddress: PublicKey,
    userLpTokenAddress: PublicKey,
    tokenInAmount: BN,
    minimumLpTokenAmount: BN,
    sarosSwapProgramId: PublicKey,
    ): TransactionInstruction {
    const dataLayout = borsh.struct([
      borsh.u8('instruction'),
      borsh.u64('sourceTokenAmount'),
      borsh.u64('minimumPoolTokenAmount'),
    ]);
    const request = {
      instruction: 4, // depositSingleTokenTypeExactAmountIn instruction
      sourceTokenAmount: tokenInAmount,
      minimumPoolTokenAmount: minimumLpTokenAmount
    };
    const data = BorshService.serialize(dataLayout, request, 128);

    const [poolAuthorityAddress,] = this.findPoolAuthorityAddress(
      poolAddress,
      sarosSwapProgramId,
    );
    const keys: AccountMeta[] = [
      <AccountMeta>{ pubkey: poolAddress, isSigner: false, isWritable: false },
      <AccountMeta>{ pubkey: poolAuthorityAddress, isSigner: false, isWritable: false },
      <AccountMeta>{ pubkey: userDelegateAddress, isSigner: true, isWritable: false },
      <AccountMeta>{ pubkey: userTokenInAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: poolToken0Address, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: poolToken1Address, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: poolLpTokenMintAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: userLpTokenAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      data,
      keys,
      programId: sarosSwapProgramId,
    });
  }

  static withdrawSingleTokenTypeExactAmountOut(
    poolAddress: PublicKey,
    poolToken0Address: PublicKey,
    poolToken1Address: PublicKey,
    poolLpTokenMintAddress: PublicKey,
    protocolFeeLpTokenAddress: PublicKey,
    userDelegateAddress: PublicKey,
    userTokenOutAdddress: PublicKey,
    userLpTokenAddress: PublicKey,
    tokenOutAmount: BN,
    maximumLpTokenAmount: BN,
    sarosSwapProgramId: PublicKey,
  ): TransactionInstruction {
    const dataLayout = borsh.struct([
      borsh.u8('instruction'),
      borsh.u64('destinationTokenAmount'),
      borsh.u64('maximumPoolTokenAmount'),
    ]);
    const request = {
      instruction: 5, // withdrawSingleTokenTypeExactAmountOut instruction
      destinationTokenAmount: tokenOutAmount,
      maximumPoolTokenAmount: maximumLpTokenAmount,
    };
    const data = BorshService.serialize(dataLayout, request, 128);

    const [poolAuthorityAddress,] = this.findPoolAuthorityAddress(
      poolAddress,
      sarosSwapProgramId,
    );
    const keys: AccountMeta[] = [
      <AccountMeta>{ pubkey: poolAddress, isSigner: false, isWritable: false },
      <AccountMeta>{ pubkey: poolAuthorityAddress, isSigner: false, isWritable: false },
      <AccountMeta>{ pubkey: userDelegateAddress, isSigner: true, isWritable: false },
      <AccountMeta>{ pubkey: poolLpTokenMintAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: userLpTokenAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: poolToken0Address, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: poolToken1Address, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: userTokenOutAdddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: protocolFeeLpTokenAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      data,
      keys,
      programId: sarosSwapProgramId,
    });
  }

  static updatePool(
    poolAddress: PublicKey,
    protocolFeeLpTokenAddress: PublicKey,
    sarosSwapProgramId: PublicKey,
  ): TransactionInstruction {
    const dataLayout = borsh.struct([
      borsh.u8('instruction'),
    ]);
    const request = {
      instruction: 6, // InitializeSwap instruction
    };
    const data = BorshService.serialize(dataLayout, request, 1024);

    const [poolAuthorityAddress,] = this.findPoolAuthorityAddress(
      poolAddress,
      sarosSwapProgramId,
    );
    const keys: AccountMeta[] = [
      <AccountMeta>{ pubkey: poolAddress, isSigner: false, isWritable: true },
      <AccountMeta>{ pubkey: poolAuthorityAddress, isSigner: false, isWritable: false },
      <AccountMeta>{ pubkey: protocolFeeLpTokenAddress, isSigner: false, isWritable: false },
      <AccountMeta>{ pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      data,
      keys,
      programId: sarosSwapProgramId,
    });
  }

  static decodePoolData(
    data,
  ): PoolInfo {
    const dataDecoded = BorshService.deserialize<PoolData>(TokenSwapLayout, data)
    return <PoolInfo>{
      version: dataDecoded.version,
      state: dataDecoded.state,
      nonce: dataDecoded.bumpSeed,
      tokenProgramId: dataDecoded.tokenProgramId,
      lpTokenMint: dataDecoded.tokenPool,
      feeAccount: dataDecoded.feeAccount,
      token0Mint: dataDecoded.mintA,
      token0Account: dataDecoded.tokenAccountA,
      token1Mint: dataDecoded.mintB,
      token1Account: dataDecoded.tokenAccountB,
      tradeFeeNumerator: dataDecoded.tradeFeeNumerator,
      tradeFeeDenominator: dataDecoded.tradeFeeDenominator,
      ownerTradeFeeNumerator: dataDecoded.ownerTradeFeeNumerator,
      ownerTradeFeeDenominator: dataDecoded.ownerTradeFeeDenominator,
      ownerWithdrawFeeNumerator: dataDecoded.ownerWithdrawFeeNumerator,
      ownerWithdrawFeeDenominator: dataDecoded.ownerWithdrawFeeDenominator,
      hostFeeNumerator: dataDecoded.hostFeeNumerator,
      hostFeeDenominator: dataDecoded.hostFeeDenominator,
      curveType: dataDecoded.curveType,
      curveParameters: dataDecoded.curveParameters,
    }
  }

  static findPoolSeed(
    token0MintAddress: PublicKey,
    token1MintAddress: PublicKey,
    sarosSwapProgramId: PublicKey,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [token0MintAddress.toBuffer(), token1MintAddress.toBuffer()],
      sarosSwapProgramId,
    );
  }

  static findPoolAuthorityAddress(
    poolAddress: PublicKey,
    sarosSwapProgramId: PublicKey,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [poolAddress.toBuffer()],
      sarosSwapProgramId,
    );
  }
}
