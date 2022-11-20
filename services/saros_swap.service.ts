import {
  INITIALIZE_MINT_SPAN,
  sendTransaction,
  SolanaService,
  TokenProgramInstructionService,
  TokenProgramService,
  TOKEN_PROGRAM_ID
} from '@coin98/solana-support-library';
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction
} from '@solana/web3.js';
import BN from 'bn.js';
import {
  INITIALIZE_POOL_SPAN,
  SarosSwapInstructionService
} from './saros_swap.instruction';

const TRADING_FEE_NUMERATOR = new BN(25); // For LP
const TRADING_FEE_DENOMINATOR = new BN(10000);
const OWNER_TRADING_FEE_NUMERATOR = new BN(5); // For Protocol
const OWNER_TRADING_FEE_DENOMINATOR = new BN(10000);
const OWNER_WITHDRAW_FEE_NUMERATOR = new BN(0); // For Protocol
const OWNER_WITHDRAW_FEE_DENOMINATOR = new BN(0);
const HOST_FEE_NUMERATOR = new BN(20); // For Partner
const HOST_FEE_DENOMINATOR = new BN(100);

export class SarosSwapService {

  static async createPool(
    connection: Connection,
    payerAccount: Keypair,
    protocolFeeAddress: PublicKey, // SOL address
    token0MintAddress: PublicKey,
    token1MintAddress: PublicKey,
    userAccount: Keypair,
    userToken0Address: PublicKey,
    userToken1Address: PublicKey,
    token0Amount: number,
    token1Amount: number,
    curveType: number,
    curveParameters: BN,
    sarosSwapProgramId: PublicKey,
  ): Promise<PublicKey> {
    const transaction = new Transaction()

    // POOL ACCOUNT
    const poolAccount = this.findPoolAccount(
      token0MintAddress,
      token1MintAddress,
      sarosSwapProgramId,
    );
    const [poolAuthorityAddress,] = this.findPoolAuthorityAddress(
      poolAccount.publicKey,
      sarosSwapProgramId,
    );

    // POOL LP TOKEN MINT
    const poolLpMintAccount = this.findPoolLpMint(
      poolAccount.publicKey,
      sarosSwapProgramId,
    );
    if (await SolanaService.isAddressAvailable(connection, poolLpMintAccount.publicKey)) {
      const lamportsToInitializeMint = await connection.getMinimumBalanceForRentExemption(INITIALIZE_MINT_SPAN);
      const createAccountInstruction = SystemProgram.createAccount({
        fromPubkey: payerAccount.publicKey,
        newAccountPubkey: poolLpMintAccount.publicKey,
        lamports: lamportsToInitializeMint,
        space: INITIALIZE_MINT_SPAN,
        programId: TOKEN_PROGRAM_ID,
      });
      transaction.add(createAccountInstruction);

      const initializeTokenMintInstruction = TokenProgramInstructionService.initializeMint(
        poolLpMintAccount.publicKey,
        8,
        poolAuthorityAddress,
        null,
      );
      transaction.add(initializeTokenMintInstruction);
    }

    // POOL TOKEN ACCOUNTS
    // Token0
    const poolToken0Address = TokenProgramService.findAssociatedTokenAddress(
      poolAuthorityAddress,
      token0MintAddress,
    );
    if (await SolanaService.isAddressAvailable(connection, poolToken0Address)) {
      const createATAInstruction = TokenProgramInstructionService.createAssociatedTokenAccount(
        payerAccount.publicKey,
        poolAuthorityAddress,
        token0MintAddress,
      );
      transaction.add(createATAInstruction);
    }
    // Token1
    const poolToken1Address = TokenProgramService.findAssociatedTokenAddress(
      poolAuthorityAddress,
      token1MintAddress,
    )
    if (await SolanaService.isAddressAvailable(connection, poolToken1Address)) {
      const createATAInstruction = TokenProgramInstructionService.createAssociatedTokenAccount(
        payerAccount.publicKey,
        poolAuthorityAddress,
        token1MintAddress,
      );
      transaction.add(createATAInstruction);
    }

    // USER TOKEN ACCOUNT
    const userLpTokenAddress = TokenProgramService.findAssociatedTokenAddress(
      userAccount.publicKey,
      poolLpMintAccount.publicKey,
    );
    if (await SolanaService.isAddressAvailable(connection, userLpTokenAddress)) {
      const createATAInstruction = TokenProgramInstructionService.createAssociatedTokenAccount(
        payerAccount.publicKey,
        userAccount.publicKey,
        poolLpMintAccount.publicKey,
      );
      transaction.add(createATAInstruction);
    }

    // FEE TOKEN ACCOUNT
    const protocolFeeLpTokenAddress = TokenProgramService.findAssociatedTokenAddress(
      protocolFeeAddress,
      poolLpMintAccount.publicKey,
    );
    if (
      userAccount.publicKey.toBase58() !== protocolFeeAddress.toBase58()
      && await SolanaService.isAddressAvailable(connection, protocolFeeLpTokenAddress)
    ) {
      const createATAInstruction = TokenProgramInstructionService.createAssociatedTokenAccount(
        payerAccount.publicKey,
        protocolFeeAddress,
        poolLpMintAccount.publicKey,
      );
      transaction.add(createATAInstruction);
    }

    // PRE-DEPOSIT TO POOL TOKEN ACCOUNTS
    const transferToken0Instruction = TokenProgramInstructionService.transfer(
      userAccount.publicKey,
      userToken0Address,
      poolToken0Address,
      new BN(token0Amount),
    );
    transaction.add(transferToken0Instruction);
    const transferToken1Instruction = TokenProgramInstructionService.transfer(
      userAccount.publicKey,
      userToken1Address,
      poolToken1Address,
      new BN(token1Amount),
    );
    transaction.add(transferToken1Instruction);

    // CREATE POOL
    const lamportsToCreatePool = await connection.getMinimumBalanceForRentExemption(INITIALIZE_POOL_SPAN);
    if (!await SolanaService.isAddressInUse(connection, poolAccount.publicKey)) {
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: payerAccount.publicKey,
          newAccountPubkey: poolAccount.publicKey,
          lamports: lamportsToCreatePool,
          space: INITIALIZE_POOL_SPAN,
          programId: sarosSwapProgramId,
        }),
      );
    }
    const tokenSwapInstruction = SarosSwapInstructionService.createPool(
      poolAccount.publicKey,
      poolToken0Address,
      poolToken1Address,
      poolLpMintAccount.publicKey,
      protocolFeeLpTokenAddress,
      userLpTokenAddress,
      TRADING_FEE_NUMERATOR,
      TRADING_FEE_DENOMINATOR,
      OWNER_TRADING_FEE_NUMERATOR,
      OWNER_TRADING_FEE_DENOMINATOR,
      OWNER_WITHDRAW_FEE_NUMERATOR,
      OWNER_WITHDRAW_FEE_DENOMINATOR,
      HOST_FEE_NUMERATOR,
      HOST_FEE_DENOMINATOR,
      curveType,
      curveParameters,
      sarosSwapProgramId,
    )
    transaction.add(tokenSwapInstruction);

    const txSign = await sendTransaction(connection, transaction, [
      userAccount,
      poolLpMintAccount,
      poolAccount,
    ]);

    console.info(`Created pool ${poolAccount.publicKey}`, '---', txSign, '\n');
    return poolAccount.publicKey;
  }

  static async swap(
    connection: Connection,
    payerAccount: Keypair,
    poolAddress: PublicKey,
    delegateAccount: Keypair,
    userTokenInAddress: PublicKey,
    userTokenOutAddress: PublicKey,
    amountIn: BN,
    minimumAmountOut: BN,
    partnerFeeAddress: PublicKey,
    sarosSwapProgramId: PublicKey,
  ) {
    const transaction = new Transaction();

    const poolAccountInfo = await SarosSwapService.getPoolInfo(
      connection,
      poolAddress,
      false,
    )
    const userTokenInAccountInfo = await TokenProgramService.getTokenAccountInfo(
      connection,
      userTokenInAddress,
    );
    const userTokenOutAccountInfo = await TokenProgramService.getTokenAccountInfo(
      connection,
      userTokenOutAddress,
    );

    let poolTokenInAddress = null;
    let poolTokenOutAddress = null;
    if (userTokenInAccountInfo.mint.toBase58() === poolAccountInfo.token0Mint.toBase58()) {
      poolTokenInAddress = poolAccountInfo.token0Account;
    }
    if (userTokenInAccountInfo.mint.toBase58() === poolAccountInfo.token1Mint.toBase58()) {
      poolTokenInAddress = poolAccountInfo.token1Account;
    }
    if (userTokenOutAccountInfo.mint.toBase58() === poolAccountInfo.token0Mint.toBase58()) {
      poolTokenOutAddress = poolAccountInfo.token0Account;
    }
    if (userTokenOutAccountInfo.mint.toBase58() === poolAccountInfo.token1Mint.toBase58()) {
      poolTokenOutAddress = poolAccountInfo.token1Account;
    }

    let parterFeeLpTokenAddress = null;
    if (partnerFeeAddress) {
      parterFeeLpTokenAddress = TokenProgramService.findAssociatedTokenAddress(
        partnerFeeAddress,
        poolAccountInfo.lpTokenMint,
      );
      if (await SolanaService.isAddressAvailable(connection, parterFeeLpTokenAddress)) {
        const createATAInstruction = TokenProgramInstructionService.createAssociatedTokenAccount(
          payerAccount.publicKey,
          partnerFeeAddress,
          poolAccountInfo.lpTokenMint,
        )
        transaction.add(createATAInstruction);
      }
    }

    const swapInstruction = SarosSwapInstructionService.swap(
      poolAddress,
      poolTokenInAddress,
      poolTokenOutAddress,
      poolAccountInfo.lpTokenMint,
      poolAccountInfo.feeAccount,
      delegateAccount.publicKey,
      userTokenInAddress,
      userTokenOutAddress,
      amountIn,
      minimumAmountOut,
      parterFeeLpTokenAddress,
      sarosSwapProgramId,
    )
    transaction.add(swapInstruction);

    const txSign = await sendTransaction(connection, transaction, [
      payerAccount,
      delegateAccount,
    ]);

    console.info(`Swap to pool ${poolAddress}`, '---', txSign, '\n');
    return true;
  }

  static async depositAllTokenTypes(
    connection: Connection,
    payerAccount: Keypair,
    poolAddress: PublicKey,
    delegateAccount: Keypair,
    userAddress: PublicKey,
    userToken0Address: PublicKey,
    userToken1Address: PublicKey,
    maxToken0Amount: BN,
    maxToken1Amount: BN,
    sarosSwapProgramId: PublicKey,
  ): Promise<boolean> {
    const transaction = new Transaction();

    const poolAccountInfo = await SarosSwapService.getPoolInfo(
      connection,
      poolAddress,
      true,
    );

    const depositorLpTokenAddress = TokenProgramService.findAssociatedTokenAddress(
      userAddress,
      poolAccountInfo.lpTokenMint,
    );
    if (await SolanaService.isAddressAvailable(connection, depositorLpTokenAddress)) {
      const createATAInstruction = TokenProgramInstructionService.createAssociatedTokenAccount(
        payerAccount.publicKey,
        userAddress,
        poolAccountInfo.lpTokenMint,
      );
      transaction.add(createATAInstruction);
    }

    const lpTokenForToken0 = maxToken0Amount.div(poolAccountInfo.lpTokenSupply);
    const lpTokenForToken1 = maxToken1Amount.div(poolAccountInfo.lpTokenSupply);
    const lpTokenAmount = BN.min(lpTokenForToken0, lpTokenForToken1);

    const depositInstruction = SarosSwapInstructionService.depositAllTokenTypes(
      poolAddress,
      poolAccountInfo.token0Account,
      poolAccountInfo.token1Account,
      poolAccountInfo.lpTokenMint,
      delegateAccount.publicKey,
      userToken0Address,
      userToken1Address,
      depositorLpTokenAddress,
      lpTokenAmount,
      maxToken0Amount,
      maxToken1Amount,
      sarosSwapProgramId,
    );
    transaction.add(depositInstruction);

    const txSign = await sendTransaction(connection, transaction, [
      payerAccount,
      delegateAccount,
    ]);

    console.info(`Deposited to pool ${poolAddress}`, '---', txSign, '\n');
    return true;
  }

  static async withdrawAllTokenTypes(
    connection: Connection,
    payerAccount: Keypair,
    poolAddress: PublicKey,
    delegateAccount: Keypair,
    userToken0Address: PublicKey,
    userToken1Address: PublicKey,
    userLpTokenAddress: PublicKey,
    lpTokenAmount: BN,
    sarosSwapProgramId: PublicKey,
  ): Promise<boolean> {
    const transaction = new Transaction();

    const poolAccountInfo = await SarosSwapService.getPoolInfo(
      connection,
      poolAddress,
      true,
    );

    let feeAmount = new BN(0);
    if (!OWNER_WITHDRAW_FEE_NUMERATOR.eqn(0)) {
      feeAmount = lpTokenAmount.mul(OWNER_WITHDRAW_FEE_NUMERATOR).div(OWNER_WITHDRAW_FEE_DENOMINATOR);
    }
    const withdrawLpTokenAmount = lpTokenAmount.sub(feeAmount);

    const minToken0Amount = poolAccountInfo.token0Amount.mul(withdrawLpTokenAmount).div(poolAccountInfo.lpTokenSupply);
    const minToken1Amount = poolAccountInfo.token1Amount.mul(withdrawLpTokenAmount).div(poolAccountInfo.lpTokenSupply);

    const withdrawInstruction = SarosSwapInstructionService.withdrawAllTokenTypes(
      poolAddress,
      poolAccountInfo.lpTokenMint,
      poolAccountInfo.feeAccount,
      poolAccountInfo.token0Account,
      poolAccountInfo.token1Account,
      delegateAccount.publicKey,
      userLpTokenAddress,
      userToken0Address,
      userToken1Address,
      lpTokenAmount,
      minToken0Amount,
      minToken1Amount,
      sarosSwapProgramId,
    );
    transaction.add(withdrawInstruction);

    const txSign = await sendAndConfirmTransaction(connection, transaction, [
      payerAccount,
      delegateAccount,
    ]);

    console.info(`Withdraw from pool ${poolAddress}`, '---', txSign, '\n');
    return true;
  }

  static async depositSingleTokenType(
    connection: Connection,
    payerAccount: Keypair,
    poolAddress: PublicKey,
    delegateAccount: Keypair,
    userAddress: PublicKey,
    userTokenInAddress: PublicKey,
    tokenInAmount: BN,
    sarosSwapProgramId: PublicKey,
  ): Promise<boolean> {
    const transaction = new Transaction();

    const poolAccountInfo = await SarosSwapService.getPoolInfo(
      connection,
      poolAddress,
      true,
    );

    const userTokenAccountInfo = await TokenProgramService.getTokenAccountInfo(
      connection,
      userTokenInAddress,
    );

    let poolTokenXAmount = null;
    if (userTokenAccountInfo.mint.toBase58() === poolAccountInfo.token0Mint.toBase58()) {
      poolTokenXAmount = poolAccountInfo.token0Amount;
    }
    if (userTokenAccountInfo.mint.toBase58() === poolAccountInfo.token1Mint.toBase58()) {
      poolTokenXAmount = poolAccountInfo.token1Amount;
    }

    const lpTokenAmount = calculateTokensToLpTokens(
      tokenInAmount,
      poolTokenXAmount,
      poolAccountInfo.lpTokenSupply,
    );

    const userLpTokenAddress = TokenProgramService.findAssociatedTokenAddress(
      userAddress,
      poolAccountInfo.lpTokenMint,
    )
    if (await SolanaService.isAddressAvailable(connection, userLpTokenAddress)) {
      const createATAInstruction = TokenProgramInstructionService.createAssociatedTokenAccount(
        payerAccount.publicKey,
        userAddress,
        poolAccountInfo.lpTokenMint,
      );
      transaction.add(createATAInstruction);
    }

    const depositInstruction = SarosSwapInstructionService.depositSingleTokenTypeExactAmountIn(
      poolAddress,
      poolAccountInfo.token0Account,
      poolAccountInfo.token1Account,
      poolAccountInfo.lpTokenMint,
      delegateAccount.publicKey,
      userTokenInAddress,
      userLpTokenAddress,
      tokenInAmount,
      lpTokenAmount,
      sarosSwapProgramId,
    );
    transaction.add(depositInstruction);

    const txSign = await sendAndConfirmTransaction(connection, transaction, [
      payerAccount,
      delegateAccount,
    ]);

    console.info(`Deposited to pool ${poolAddress}`, '---', txSign, '\n');
    return true;
  }

  static async withdrawSingleTokenType(
    connection: Connection,
    payerAccount: Keypair,
    poolAddress: PublicKey,
    delegateAccount: Keypair,
    userTokenOutAddress: PublicKey,
    userLpTokenAddress: PublicKey,
    tokenOutAmount: BN,
    sarosSwapProgramId: PublicKey,
  ): Promise<boolean> {
    const transaction = new Transaction();

    const poolAccountInfo = await SarosSwapService.getPoolInfo(
      connection,
      poolAddress,
      true,
    );

    const userTokenAccountInfo = await TokenProgramService.getTokenAccountInfo(
      connection,
      userTokenOutAddress,
    );

    let poolTokenXAmount = null;
    if (userTokenAccountInfo.mint.toBase58() === poolAccountInfo.token0Mint.toBase58()) {
      poolTokenXAmount = poolAccountInfo.token0Amount;
    }
    if (userTokenAccountInfo.mint.toBase58() === poolAccountInfo.token1Mint.toBase58()) {
      poolTokenXAmount = poolAccountInfo.token1Amount;
    }

    const lpTokenAmount = calculateTokensToLpTokens(
      tokenOutAmount,
      poolTokenXAmount.sub(tokenOutAmount),
      poolAccountInfo.lpTokenSupply,
    );
    let adjustedLpTokenAmount = lpTokenAmount.muln(1.0001);
    if (!OWNER_WITHDRAW_FEE_NUMERATOR.eqn(0)) {
      adjustedLpTokenAmount = adjustedLpTokenAmount
        .mul(OWNER_WITHDRAW_FEE_NUMERATOR.add(OWNER_WITHDRAW_FEE_DENOMINATOR))
        .divRound(OWNER_WITHDRAW_FEE_DENOMINATOR);
    }

    const depositInstruction = SarosSwapInstructionService.withdrawSingleTokenTypeExactAmountOut(
      poolAddress,
      poolAccountInfo.token0Account,
      poolAccountInfo.token1Account,
      poolAccountInfo.lpTokenMint,
      poolAccountInfo.feeAccount,
      delegateAccount.publicKey,
      userTokenOutAddress,
      userLpTokenAddress,
      tokenOutAmount,
      adjustedLpTokenAmount,
      sarosSwapProgramId,
    );
    transaction.add(depositInstruction);

    const txSign = await sendAndConfirmTransaction(connection, transaction, [
      payerAccount,
      delegateAccount,
    ]);

    console.info(`Withdaw from pool ${poolAddress}`, '---', txSign, '\n');
    return true;
  }

  static async getPoolInfo(
    connection: Connection,
    poolAddress: PublicKey,
    includeBalance: boolean,
  ) {
    const accountInfo = await connection.getAccountInfo(poolAddress);
    const poolInfo = SarosSwapInstructionService.decodePoolData(accountInfo.data);
    if(includeBalance) {
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
    return poolInfo;
  }

  static async printPoolInfo(
    connection: Connection,
    poolAddress: PublicKey,
  ) {
    const accountData = await SarosSwapService.getPoolInfo(connection, poolAddress, false);
    console.info('--- POOL ACCOUNT INFO ---');
    console.info(`Address:                          ${poolAddress.toBase58()} -- ${poolAddress.toBuffer().toString('hex')}`);
    console.info(`Version:                          ${accountData.version}`);
    console.info(`State:                            ${accountData.state}`);
    console.info(`Token Program Id:                 ${accountData.tokenProgramId.toBase58()} -- ${accountData.tokenProgramId.toBuffer().toString('hex')}`);
    console.info(`LP Token Mint:                    ${accountData.lpTokenMint.toBase58()} -- ${accountData.lpTokenMint.toBuffer().toString('hex')}`);
    console.info(`Protocol Fee LP Token:            ${accountData.feeAccount.toBase58()} -- ${accountData.feeAccount.toBuffer().toString('hex')}`);
    console.info(`Token 0 Mint:                     ${accountData.token0Mint.toBase58()} -- ${accountData.token0Mint.toBuffer().toString('hex')}`);
    console.info(`Pool Token 0:                     ${accountData.token0Account.toBase58()} -- ${accountData.token0Account.toBuffer().toString('hex')}`);
    console.info(`Token 1 Mint:                     ${accountData.token1Mint.toBase58()} -- ${accountData.token1Mint.toBuffer().toString('hex')}`);
    console.info(`Pool Token 1:                     ${accountData.token1Account.toBase58()} -- ${accountData.token1Account.toBuffer().toString('hex')}`);
    console.info(`Trade Fee Numerator:              ${accountData.tradeFeeNumerator.toString()}`);
    console.info(`Trade Fee Denominator:            ${accountData.tradeFeeDenominator.toString()}`);
    console.info(`Owner Trade Fee Numerator:        ${accountData.ownerTradeFeeNumerator.toString()}`);
    console.info(`Owner Trade Fee Denominator:      ${accountData.ownerTradeFeeDenominator.toString()}`);
    console.info(`Owner Withdraw Fee Numerator:     ${accountData.ownerWithdrawFeeNumerator.toString()}`);
    console.info(`Owner Withdraw Fee Denominator:   ${accountData.ownerWithdrawFeeDenominator.toString()}`);
    console.info(`Host Fee Numerator:               ${accountData.hostFeeNumerator.toString()}`);
    console.info(`Host Fee Denominator:             ${accountData.hostFeeDenominator.toString()}`);
    console.info(`Curve Type:                       ${accountData.curveType}`);
    console.info(`Curve Parameters:                 ${accountData.curveParameters.toString()}`);

    console.info('');
  }

  static findPoolAccount(
    token0MintAddress: PublicKey,
    token1MintAddress: PublicKey,
    sarosSwapProgramId: PublicKey,
  ): Keypair {
    const [poolAccountSeed,] = this.findPoolSeed(
      token0MintAddress,
      token1MintAddress,
      sarosSwapProgramId,
    );
    return Keypair.fromSeed(
      poolAccountSeed.toBuffer(),
    );
  }

  static findPoolLpMint(
    poolAddress: PublicKey,
    sarosSwapProgramId: PublicKey,
  ): Keypair {
    const [poolAuthorityAddress,] = this.findPoolAuthorityAddress(
      poolAddress,
      sarosSwapProgramId,
    );
    return Keypair.fromSeed(
      poolAuthorityAddress.toBuffer()
    );
  }

  static findPoolSeed(
    token0MintAddress: PublicKey,
    token1MintAddress: PublicKey,
    sarosSwapProgramId: PublicKey,
  ): [PublicKey, number] {
    return SarosSwapInstructionService.findPoolSeed(
      token0MintAddress,
      token1MintAddress,
      sarosSwapProgramId,
    );
  }

  static findPoolAuthorityAddress(
    poolAddress: PublicKey,
    sarosSwapProgramId: PublicKey,
  ): [PublicKey, number] {
    return SarosSwapInstructionService.findPoolAuthorityAddress(
      poolAddress,
      sarosSwapProgramId,
    );
  }

  static findPoolAuthorityAddressByToken(
    token0MintAddress: PublicKey,
    token1MintAddress: PublicKey,
    sarosSwapProgramId: PublicKey,
  ): [PublicKey, number] {
    const poolAccount = this.findPoolAccount(
      token0MintAddress,
      token1MintAddress,
      sarosSwapProgramId,
    );
    return this.findPoolAuthorityAddress(
      poolAccount.publicKey,
      sarosSwapProgramId,
    );
  }
}

function calculateTokensToLpTokens(
  sourceAmount: BN,
  swapSourceAmount: BN,
  poolAmount: BN,
): BN {
  const tradingFee = sourceAmount.mul(TRADING_FEE_NUMERATOR).div(TRADING_FEE_DENOMINATOR.muln(2));
  const sourceAmountPostFee = sourceAmount.sub(tradingFee);
  const root = Math.sqrt(sourceAmountPostFee.div(swapSourceAmount).addn(1).toNumber());
  const lpTokenAmount = poolAmount.muln(root - 1);
  return lpTokenAmount;
}