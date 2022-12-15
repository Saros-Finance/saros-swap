//! Error types

use num_derive::FromPrimitive;
use solana_program::{decode_error::DecodeError, program_error::ProgramError};
use thiserror::Error;

/// Errors that may be returned by the TokenSwap program.
#[derive(Clone, Debug, Eq, Error, FromPrimitive, PartialEq)]
pub enum SwapError {
    // 0.
    /// The account cannot be initialized because it is already being used.
    #[error("Swap account already in use")]
    AlreadyInUse,
    /// The program address provided doesn't match the value generated by the program.
    #[error("Invalid program address generated from bump seed and key")]
    InvalidProgramAddress,
    /// The owner of the input isn't set to the program address generated by the program.
    #[error("Input account owner is not the program address")]
    InvalidOwner,
    /// The owner of the pool token output is set to the program address generated by the program.
    #[error("Output pool account owner cannot be the program address")]
    InvalidOutputOwner,
    /// The deserialization of the account returned something besides State::Mint.
    #[error("Deserialized account is not an SPL Token mint")]
    ExpectedMint,
    /// The account cannot be update because it is not being used.
    #[error("Swap account is not be initialized")]
    NotBeInitialized,

    // 5.
    /// The deserialization of the account returned something besides State::Account.
    #[error("Deserialized account is not an SPL Token account")]
    ExpectedAccount,
    /// The input token account is empty.
    #[error("Input token account empty")]
    EmptySupply,
    /// The pool token mint has a non-zero supply.
    #[error("Pool token mint has a non-zero supply")]
    InvalidSupply,
    /// The provided token account has a delegate.
    #[error("Token account has a delegate")]
    InvalidDelegate,
    /// The input token is invalid for swap.
    #[error("InvalidInput")]
    InvalidInput,

    // 10.
    /// Address of the provided swap token account is incorrect.
    #[error("Address of the provided swap token account is incorrect")]
    IncorrectSwapAccount,
    /// Address of the provided pool token mint is incorrect
    #[error("Address of the provided pool token mint is incorrect")]
    IncorrectPoolMint,
    /// The output token is invalid for swap.
    #[error("InvalidOutput")]
    InvalidOutput,
    /// General calculation failure due to overflow or underflow
    #[error("General calculation failure due to overflow or underflow")]
    CalculationFailure,
    /// Invalid instruction number passed in.
    #[error("Invalid instruction")]
    InvalidInstruction,

    // 15.
    /// Swap input token accounts have the same mint
    #[error("Swap input token accounts have the same mint")]
    RepeatedMint,
    /// Swap instruction exceeds desired slippage limit
    #[error("Swap instruction exceeds desired slippage limit")]
    ExceededSlippage,
    /// The provided token account has a close authority.
    #[error("Token account has a close authority")]
    InvalidCloseAuthority,
    /// The pool token mint has a freeze authority.
    #[error("Pool token mint has a freeze authority")]
    InvalidFreezeAuthority,
    /// The pool fee token account is incorrect
    #[error("Pool fee token account incorrect")]
    IncorrectFeeAccount,

    // 20.
    /// Given pool token amount results in zero trading tokens
    #[error("Given pool token amount results in zero trading tokens")]
    ZeroTradingTokens,
    /// The fee calculation failed due to overflow, underflow, or unexpected 0
    #[error("Fee calculation failed due to overflow, underflow, or unexpected 0")]
    FeeCalculationFailure,
    /// ConversionFailure
    #[error("Conversion to u64 failed with an overflow or underflow")]
    ConversionFailure,
    /// The provided fee does not match the program owner's constraints
    #[error("The provided fee does not match the program owner's constraints")]
    InvalidFee,
    /// The provided token program does not match the token program expected by the swap
    #[error("The provided token program does not match the token program expected by the swap")]
    IncorrectTokenProgramId,

    // 25.
    /// The provided curve type is not supported by the program owner
    #[error("The provided curve type is not supported by the program owner")]
    UnsupportedCurveType,
    /// The provided curve parameters are invalid
    #[error("The provided curve parameters are invalid")]
    InvalidCurve,
    /// The operation cannot be performed on the given curve
    #[error("The operation cannot be performed on the given curve")]
    UnsupportedCurveOperation,

}
impl From<SwapError> for ProgramError {
    fn from(e: SwapError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
impl<T> DecodeError<T> for SwapError {
    fn type_of() -> &'static str {
        "Swap Error"
    }
}
