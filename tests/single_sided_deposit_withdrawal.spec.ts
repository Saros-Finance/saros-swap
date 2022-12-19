// import {
//   SystemProgramService,
//   TokenProgramService
// } from '@coin98/solana-support-library';
// import {
//   SolanaConfigService,
//   TestAccountService,
//   TokenName
// } from '@coin98/solana-support-library/config';
// import {
//   Connection,
//   Keypair,
//   PublicKey
// } from '@solana/web3.js';
// import BN from 'bn.js';
// import { SarosSwapService } from '../services/saros_swap.service';

// describe('single_sided_deposit_withdrawal_tests', function() {

//   const PROGRAM_ID = new PublicKey('StaGHXrozaggJ7a9Y8U5ak5NxxZgYVdrBG9kQwbHAes');

//   const connection = new Connection('http://localhost:8899', 'confirmed');
//   let poolAccount: Keypair
//   let defaultAccount: Keypair;
//   let ownerAccount: Keypair;
//   let testAccount1: Keypair;
//   let testAccount2: Keypair;
//   let usdcTokenAccount: Keypair;
//   let usdtTokenAccount: Keypair;

//   before(async function() {
//     poolAccount = Keypair.generate();
//     defaultAccount = await SolanaConfigService.getDefaultAccount();
//     ownerAccount = await TestAccountService.getAccount(0);
//     testAccount1 = await TestAccountService.getAccount(1);
//     testAccount2 = await TestAccountService.getAccount(2);
//     usdcTokenAccount = TestAccountService.getNamedTokenAccount(TokenName.USDC);
//     usdtTokenAccount = TestAccountService.getNamedTokenAccount(TokenName.USDT);

//     await SystemProgramService.transfer(
//       connection,
//       defaultAccount,
//       ownerAccount.publicKey,
//       1000000,
//     );
//     await SystemProgramService.transfer(
//       connection,
//       defaultAccount,
//       testAccount1.publicKey,
//       1000000,
//     );

//     await TokenProgramService.createTokenMint(
//       connection,
//       defaultAccount,
//       usdcTokenAccount,
//       6,
//       ownerAccount.publicKey,
//       null,
//     );
//     await TokenProgramService.createTokenMint(
//       connection,
//       defaultAccount,
//       usdtTokenAccount,
//       6,
//       ownerAccount.publicKey,
//       null,
//     );
//   });

//   it('withdraw_single_sided', async function() {
//     const testAccount1UsdcAddress = await TokenProgramService.createAssociatedTokenAccount(
//       connection,
//       defaultAccount,
//       testAccount1.publicKey,
//       usdcTokenAccount.publicKey,
//     );
//     await TokenProgramService.mint(
//       connection,
//       ownerAccount,
//       usdcTokenAccount.publicKey,
//       testAccount1UsdcAddress,
//       new BN('10000000000'),
//     );
//     const testAccount1UsdtAddress = await TokenProgramService.createAssociatedTokenAccount(
//       connection,
//       defaultAccount,
//       testAccount1.publicKey,
//       usdtTokenAccount.publicKey,
//     );
//     await TokenProgramService.mint(
//       connection,
//       ownerAccount,
//       usdtTokenAccount.publicKey,
//       testAccount1UsdtAddress,
//       new BN('10000000000'),
//     );

//     await SarosSwapService.createPool(
//       connection,
//       defaultAccount,
//       poolAccount,
//       ownerAccount.publicKey,
//       usdcTokenAccount.publicKey,
//       usdtTokenAccount.publicKey,
//       testAccount1,
//       testAccount1.publicKey,
//       testAccount1UsdcAddress,
//       testAccount1UsdtAddress,
//       new BN('10000000000'),
//       new BN('10000000000'),
//       0,
//       new BN(0),
//       PROGRAM_ID,
//     );

//     const testAccount2UsdcAddress = await TokenProgramService.createAssociatedTokenAccount(
//       connection,
//       defaultAccount,
//       testAccount2.publicKey,
//       usdcTokenAccount.publicKey,
//     );
//     await TokenProgramService.mint(
//       connection,
//       ownerAccount,
//       usdcTokenAccount.publicKey,
//       testAccount2UsdcAddress,
//       new BN('10000000'),
//     );
//     const testAccount2UsdtAddress = await TokenProgramService.createAssociatedTokenAccount(
//       connection,
//       defaultAccount,
//       testAccount2.publicKey,
//       usdtTokenAccount.publicKey,
//     );
//     await TokenProgramService.mint(
//       connection,
//       ownerAccount,
//       usdtTokenAccount.publicKey,
//       testAccount2UsdtAddress,
//       new BN('10000000'),
//     );

//     await SarosSwapService.depositAllTokenTypes(
//       connection,
//       defaultAccount,
//       poolAccount.publicKey,
//       testAccount2,
//       testAccount2.publicKey,
//       testAccount2UsdcAddress,
//       testAccount2UsdtAddress,
//       new BN('10000000'),
//       new BN('10000000'),
//       PROGRAM_ID,
//     );

//     const poolInfo = await SarosSwapService.getPoolInfo(
//       connection,
//       poolAccount.publicKey,
//       false,
//     );
//     const testAccount2LpTokenAddress = TokenProgramService.findAssociatedTokenAddress(
//       testAccount2.publicKey,
//       poolInfo.lpTokenMint,
//     );

//     //const buggyLpAmount = new BN('1002506');
//     const correctLpAmount = new BN('1000000');
//     await SarosSwapService.withdrawSingleTokenType(
//       connection,
//       defaultAccount,
//       poolAccount.publicKey,
//       testAccount2,
//       testAccount2UsdcAddress,
//       testAccount2LpTokenAddress,
//       correctLpAmount,
//       PROGRAM_ID,
//     );
//   });
// });
