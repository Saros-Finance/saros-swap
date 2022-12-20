import {
    INITIALIZE_MINT_SPAN,
    sendTransaction,
    SolanaService,
    SystemProgramService,
    TokenProgramInstructionService,
    TokenProgramService,
    TOKEN_PROGRAM_ID
  } from '@coin98/solana-support-library';
  import {
    SolanaConfigService,
    TestAccountService,
    TokenName
  } from '@coin98/solana-support-library/config';
  import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
  } from '@solana/web3.js';
  import BN from 'bn.js';
import { INITIALIZE_POOL_SPAN, SarosSwapInstructionService } from '../services/saros_swap.instruction';
  import { SarosSwapService } from '../services/saros_swap.service';
// import { TRADING_FEE_NUMERATOR, TRADING_FEE_DENOMINATOR, OWNER_TRADING_FEE_NUMERATOR, OWNER_TRADING_FEE_DENOMINATOR, OWNER_WITHDRAW_FEE_NUMERATOR, OWNER_WITHDRAW_FEE_DENOMINATOR, HOST_FEE_NUMERATOR, HOST_FEE_DENOMINATOR } from '../services/saros_swap_constant';
  
  describe.only('single_sided_deposit_withdrawal_tests', function() {
  
    const PROGRAM_ID = new PublicKey('StaGHXrozaggJ7a9Y8U5ak5NxxZgYVdrBG9kQwbHAes');
  
    const connection = new Connection('http://localhost:8899', 'confirmed');
    let poolAccount: Keypair
    let defaultAccount: Keypair;
    let ownerAccount: Keypair;
    let testAccount1: Keypair;
    let testAccount2: Keypair;
    let usdcTokenAccount: Keypair;
    let usdtTokenAccount: Keypair;
  
    before(async function() {
      poolAccount = Keypair.generate();
      defaultAccount = await SolanaConfigService.getDefaultAccount();
      ownerAccount = await TestAccountService.getAccount(0);
      testAccount1 = await TestAccountService.getAccount(1);
      testAccount2 = await TestAccountService.getAccount(2);
      usdcTokenAccount = TestAccountService.getNamedTokenAccount(TokenName.USDC);
      usdtTokenAccount = TestAccountService.getNamedTokenAccount(TokenName.USDT);
  
      await SystemProgramService.transfer(
        connection,
        defaultAccount,
        ownerAccount.publicKey,
        1000000,
      );
      await SystemProgramService.transfer(
        connection,
        defaultAccount,
        testAccount1.publicKey,
        1000000,
      );
  
      await TokenProgramService.createTokenMint(
        connection,
        defaultAccount,
        usdcTokenAccount,
        6,
        ownerAccount.publicKey,
        null,
      );
      await TokenProgramService.createTokenMint(
        connection,
        defaultAccount,
        usdtTokenAccount,
        6,
        ownerAccount.publicKey,
        null,
      );
    });

    it('Update pool fee', async function() {
        const testAccount1UsdcAddress = await TokenProgramService.createAssociatedTokenAccount(
          connection,
          defaultAccount,
          testAccount1.publicKey,
          usdcTokenAccount.publicKey,
        );
        await TokenProgramService.mint(
          connection,
          ownerAccount,
          usdcTokenAccount.publicKey,
          testAccount1UsdcAddress,
          new BN('1000000000'),
        );
        const testAccount1UsdtAddress = await TokenProgramService.createAssociatedTokenAccount(
          connection,
          defaultAccount,
          testAccount1.publicKey,
          usdtTokenAccount.publicKey,
        );
        await TokenProgramService.mint(
          connection,
          ownerAccount,
          usdtTokenAccount.publicKey,
          testAccount1UsdtAddress,
          new BN('1000000000'),
        );
    
        await createPool(
          connection,
          defaultAccount,
          poolAccount,
          ownerAccount.publicKey,
          usdcTokenAccount.publicKey,
          usdtTokenAccount.publicKey,
          testAccount1,
          testAccount1.publicKey,
          testAccount1UsdcAddress,
          testAccount1UsdtAddress,
          new BN('1000000000'),
          new BN('1000000000'),
          new BN(26),
          new BN(10000),
          new BN(15),
          new BN(10000),
          new BN(10),
          new BN(10000),
          new BN(30),
          new BN(140),
          0,
          new BN(0),
          PROGRAM_ID,
        );
        
        await SarosSwapService.updatePoolFee(
          connection,
          defaultAccount,
          poolAccount.publicKey,
          ownerAccount.publicKey,
          PROGRAM_ID,
        );
      });
    
  });
  

 async function createPool(
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
    TRADING_FEE_NUMERATOR: BN,
    TRADING_FEE_DENOMINATOR: BN,
    OWNER_TRADING_FEE_NUMERATOR: BN,
    OWNER_TRADING_FEE_DENOMINATOR: BN,
    OWNER_WITHDRAW_FEE_NUMERATOR: BN,
    OWNER_WITHDRAW_FEE_DENOMINATOR: BN,
    HOST_FEE_NUMERATOR: BN,
    HOST_FEE_DENOMINATOR: BN,
    curveType: number,
    curveParameters: BN,
    sarosSwapProgramId: PublicKey,
    
  ): Promise<PublicKey> {
    const preTransaction = new Transaction();
    const transaction = new Transaction()

    // POOL ACCOUNT
    const [poolAuthorityAddress,] = await SarosSwapService.findPoolAuthorityAddress(
      poolAccount.publicKey,
      sarosSwapProgramId,
    );

    // POOL LP TOKEN MINT
    const poolLpMintAccount = await SarosSwapService.findPoolLpMint(
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