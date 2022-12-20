import {
  SystemProgramService,
  TokenProgramService
} from '@coin98/solana-support-library';
import {
  SolanaConfigService,
  TestAccountService,
  TokenName
} from '@coin98/solana-support-library/config';
import {
  Connection,
  Keypair,
  PublicKey
} from '@solana/web3.js';
import BN from 'bn.js';
import { SarosSwapService } from '../services/saros_swap.service';

describe('main_flows_tests', function() {

  const PROGRAM_ID = new PublicKey('StaGHXrozaggJ7a9Y8U5ak5NxxZgYVdrBG9kQwbHAes');

  const connection = new Connection('http://localhost:8899', 'confirmed');
  let poolAccount: Keypair
  let defaultAccount: Keypair;
  let ownerAccount: Keypair;
  let testAccount1: Keypair;
  let testAccount2: Keypair;
  let usdcTokenAccount: Keypair;
  let usdtTokenAccount: Keypair;
  let ownerAccount02: Keypair;

  before(async function() {
    poolAccount = await TestAccountService.getAccount(7);
    // poolAccount = await Keypair.generate();
    defaultAccount = await SolanaConfigService.getDefaultAccount();
    ownerAccount = await TestAccountService.getAccount(0);
    testAccount1 = await TestAccountService.getAccount(1);
    testAccount2 = await TestAccountService.getAccount(2);
    usdcTokenAccount = TestAccountService.getNamedTokenAccount(TokenName.USDC);
    usdtTokenAccount = TestAccountService.getNamedTokenAccount(TokenName.USDT);
    ownerAccount02 = await TestAccountService.getAccount(6);
    console.log(`
      poolAccount : ${poolAccount.publicKey.toString()},
      ownerAccount: ${ownerAccount.publicKey.toString()},
      ownerAccount02 (for test): ${ownerAccount02.publicKey.toString()}
    `)
    await SystemProgramService.transfer(
      connection,
      defaultAccount,
      ownerAccount.publicKey,
      1000000,
    );
    await SystemProgramService.transfer(
      connection,
      defaultAccount,
      ownerAccount02.publicKey,
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
  it('creation', async function() {
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

    await SarosSwapService.createPool(
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
      0,
      new BN(0),
      PROGRAM_ID,
    );
  });
  
  it('Update pool fee', async function() {
    await SarosSwapService.updatePoolInfo(
      connection,
      defaultAccount,
      poolAccount,
      ownerAccount02.publicKey,
      testAccount1.publicKey,
      PROGRAM_ID,
    );
  });

  it('deposit/withdraw', async function() {
    const testAccount2UsdcAddress = await TokenProgramService.createAssociatedTokenAccount(
      connection,
      defaultAccount,
      testAccount2.publicKey,
      usdcTokenAccount.publicKey,
    );
    await TokenProgramService.mint(
      connection,
      ownerAccount,
      usdcTokenAccount.publicKey,
      testAccount2UsdcAddress,
      new BN('10000000'),
    );
    const testAccount2UsdtAddress = await TokenProgramService.createAssociatedTokenAccount(
      connection,
      defaultAccount,
      testAccount2.publicKey,
      usdtTokenAccount.publicKey,
    );
    await TokenProgramService.mint(
      connection,
      ownerAccount,
      usdtTokenAccount.publicKey,
      testAccount2UsdtAddress,
      new BN('10000000'),
    );

    await SarosSwapService.depositAllTokenTypes(
      connection,
      defaultAccount,
      poolAccount.publicKey,
      testAccount2,
      testAccount2.publicKey,
      testAccount2UsdcAddress,
      testAccount2UsdtAddress,
      new BN('10000000'),
      new BN('10000000'),
      PROGRAM_ID,
    );
    const poolInfo = await SarosSwapService.getPoolInfo(
      connection,
      poolAccount.publicKey,
      false,
    );

    const testAccount2LpTokenAddress = TokenProgramService.findAssociatedTokenAddress(
      testAccount2.publicKey,
      poolInfo.lpTokenMint,
    );
    await SarosSwapService.withdrawAllTokenTypes(
      connection,
      defaultAccount,
      poolAccount.publicKey,
      testAccount2,
      testAccount2UsdcAddress,
      testAccount2UsdtAddress,
      testAccount2LpTokenAddress,
      new BN('10000000'),
      PROGRAM_ID,
    );
  });

  it('swap', async function() {
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

    await SarosSwapService.createPool(
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
      0,
      new BN(0),
      PROGRAM_ID,
    );

    const testAccount2UsdcAddress = await TokenProgramService.createAssociatedTokenAccount(
      connection,
      defaultAccount,
      testAccount2.publicKey,
      usdcTokenAccount.publicKey,
    );
    await TokenProgramService.mint(
      connection,
      ownerAccount,
      usdcTokenAccount.publicKey,
      testAccount2UsdcAddress,
      new BN('1000000000'),
    );
    const testAccount2UsdtAddress = await TokenProgramService.createAssociatedTokenAccount(
      connection,
      defaultAccount,
      testAccount2.publicKey,
      usdtTokenAccount.publicKey,
    );

    await SarosSwapService.swap(
      connection,
      defaultAccount,
      poolAccount.publicKey,
      testAccount2,
      testAccount2UsdcAddress,
      testAccount2UsdtAddress,
      new BN('1000000'),
      null,
      PROGRAM_ID,
    );
  });
});
