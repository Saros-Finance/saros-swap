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
  SystemProgram,
  Transaction
} from '@solana/web3.js';
import BN from 'bn.js';
import {
  INITIALIZE_POOL_SPAN,
  SarosSwapInstructionService
} from './saros_swap.instruction';
import { SarosSwapCalculator } from './saros_swap_calculator';
import {
  HOST_FEE_DENOMINATOR,
  HOST_FEE_NUMERATOR,
  OWNER_TRADING_FEE_DENOMINATOR,
  OWNER_TRADING_FEE_NUMERATOR,
  OWNER_WITHDRAW_FEE_DENOMINATOR,
  OWNER_WITHDRAW_FEE_NUMERATOR,
  TRADING_FEE_DENOMINATOR,
  TRADING_FEE_NUMERATOR
} from './saros_swap_constant';

export class SarosSwapService {

  static async createPool(
    connection: Connection,
    payerAccount: Keypair,
    poolAccount: Keypair,
    protocolFeeAddress: PublicKey, // SOL address
    token0MintAddress: PublicKey,
    token1MintAddress: PublicKey,
    delegateAccount: Keypair,
    userAddress: PublicKey,
    userToken0Address: PublicKey,
    userToken1Address: PublicKey,
    token0Amount: BN,
    token1Amount: BN,
    curveType: number,
    curveParameters: BN,
    sarosSwapProgramId: PublicKey,
  ): Promise<PublicKey> {
    const preTransaction = new Transaction();
    const transaction = new Transaction()

    // POOL ACCOUNT
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
      preTransaction.add(createAccountInstruction);

      const initializeTokenMintInstruction = TokenProgramInstructionService.initializeMint(
        poolLpMintAccount.publicKey,
        6,
        poolAuthorityAddress,
        null,
      );
      preTransaction.add(initializeTokenMintInstruction);
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
      preTransaction.add(createATAInstruction);
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
      preTransaction.add(createATAInstruction);
    }

    // USER TOKEN ACCOUNT
    const userLpTokenAddress = TokenProgramService.findAssociatedTokenAddress(
      userAddress,
      poolLpMintAccount.publicKey,
    );
    if (await SolanaService.isAddressAvailable(connection, userLpTokenAddress)) {
      const createATAInstruction = TokenProgramInstructionService.createAssociatedTokenAccount(
        payerAccount.publicKey,
        userAddress,
        poolLpMintAccount.publicKey,
      );
      preTransaction.add(createATAInstruction);
    }

    // FEE TOKEN ACCOUNT
    const protocolFeeLpTokenAddress = TokenProgramService.findAssociatedTokenAddress(
      protocolFeeAddress,
      poolLpMintAccount.publicKey,
    );
    if (
      userAddress.toBase58() !== protocolFeeAddress.toBase58()
      && await SolanaService.isAddressAvailable(connection, protocolFeeLpTokenAddress)
    ) {
      const createATAInstruction = TokenProgramInstructionService.createAssociatedTokenAccount(
        payerAccount.publicKey,
        protocolFeeAddress,
        poolLpMintAccount.publicKey,
      );
      preTransaction.add(createATAInstruction);
    }

    // PRE-DEPOSIT TO POOL TOKEN ACCOUNTS
    const transferToken0Instruction = TokenProgramInstructionService.transfer(
      userAddress,
      userToken0Address,
      poolToken0Address,
      new BN(token0Amount),
    );
    transaction.add(transferToken0Instruction);
    const transferToken1Instruction = TokenProgramInstructionService.transfer(
      userAddress,
      userToken1Address,
      poolToken1Address,
      new BN(token1Amount),
    );
    transaction.add(transferToken1Instruction);

    // CREATE POOL
    const lamportsToCreatePool = await connection.getMinimumBalanceForRentExemption(INITIALIZE_POOL_SPAN);
    if (await SolanaService.isAddressAvailable(connection, poolAccount.publicKey)) {
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
    );
    transaction.add(tokenSwapInstruction);

    const preTxSign = await sendTransaction(connection, preTransaction, [
      payerAccount,
      poolLpMintAccount,
    ]);

    const txSign = await sendTransaction(connection, transaction, [
      payerAccount,
      delegateAccount,
      poolAccount,
    ]);

    console.info(`Created pool ${poolAccount.publicKey}`, '---', preTxSign, '---', txSign, '\n');
    return poolAccount.publicKey;
  }

  static async createDeterministicPool(
    connection: Connection,
    payerAccount: Keypair,
    protocolFeeAddress: PublicKey, // SOL address
    token0MintAddress: PublicKey,
    token1MintAddress: PublicKey,
    delegateAccount: Keypair,
    userAddress: PublicKey,
    userToken0Address: PublicKey,
    userToken1Address: PublicKey,
    token0Amount: BN,
    token1Amount: BN,
    curveType: number,
    curveParameters: BN,
    sarosSwapProgramId: PublicKey,
  ): Promise<PublicKey> {
    const poolAccount = this.findPoolAccount(
      token0MintAddress,
      token1MintAddress,
      sarosSwapProgramId,
    );
    return this.createPool(
      connection,
      payerAccount,
      poolAccount,
      protocolFeeAddress,
      token0MintAddress,
      token1MintAddress,
      delegateAccount,
      userAddress,
      userToken0Address,
      userToken1Address,
      token0Amount,
      token1Amount,
      curveType,
      curveParameters,
      sarosSwapProgramId,
    );
  }

  static async swap(
    connection: Connection,
    payerAccount: Keypair,
    poolAddress: PublicKey,
    delegateAccount: Keypair,
    userTokenInAddress: PublicKey,
    userTokenOutAddress: PublicKey,
    tokenInAmount: BN,
    partnerFeeAddress: PublicKey,
    sarosSwapProgramId: PublicKey,
  ) {
    const transaction = new Transaction();

    const poolAccountInfo = await SarosSwapService.getPoolInfo(
      connection,
      poolAddress,
      true,
    );
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
    let minTokenOutAmount = null;
    const calculator = new SarosSwapCalculator(poolAccountInfo);
    if (userTokenInAccountInfo.mint.toBase58() === poolAccountInfo.token0Mint.toBase58()) {
      poolTokenInAddress = poolAccountInfo.token0Account;
      minTokenOutAmount = calculator.calcTokenOutAmountForSwapAtoB(
        tokenInAmount,
        0,
      );
    }
    if (userTokenInAccountInfo.mint.toBase58() === poolAccountInfo.token1Mint.toBase58()) {
      poolTokenInAddress = poolAccountInfo.token1Account;
      minTokenOutAmount = calculator.calcTokenOutAmountForSwapBtoA(
        tokenInAmount,
        0,
      );
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
      tokenInAmount,
      minTokenOutAmount,
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

    const calculator = new SarosSwapCalculator(poolAccountInfo);
    const lpTokenAmount = calculator.calcLpTokenAmountForDepositAllTypes(
      maxToken0Amount,
      maxToken1Amount,
      0,
    );

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

    const calculator = new SarosSwapCalculator(poolAccountInfo);
    const [minToken0Amount, minToken1Amount] = calculator.calcTokenAmountsForWithdrawAllTypes(
      withdrawLpTokenAmount,
      0,
    );

    const withdrawInstruction = SarosSwapInstructionService.withdrawAllTokenTypes(
      poolAddress,
      poolAccountInfo.token0Account,
      poolAccountInfo.token1Account,
      poolAccountInfo.lpTokenMint,
      poolAccountInfo.feeAccount,
      delegateAccount.publicKey,
      userToken0Address,
      userToken1Address,
      userLpTokenAddress,
      lpTokenAmount,
      minToken0Amount,
      minToken1Amount,
      sarosSwapProgramId,
    );
    transaction.add(withdrawInstruction);

    const txSign = await sendTransaction(connection, transaction, [
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

    const txSign = await sendTransaction(connection, transaction, [
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
    lpTokenAmount: BN,
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

    const calculator = new SarosSwapCalculator(poolAccountInfo);
    let tokenOutAmount = null;
    if (userTokenAccountInfo.mint.toBase58() === poolAccountInfo.token0Mint.toBase58()) {
      tokenOutAmount = calculator.calcTokenAmountForWithdrawToken0(lpTokenAmount, 0);
    }
    if (userTokenAccountInfo.mint.toBase58() === poolAccountInfo.token1Mint.toBase58()) {
      tokenOutAmount = calculator.calcTokenAmountForWithdrawToken1(lpTokenAmount, 0);
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
      lpTokenAmount,
      sarosSwapProgramId,
    );
    transaction.add(depositInstruction);

    const txSign = await sendTransaction(connection, transaction, [
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
    poolInfo.address = poolAddress;
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
