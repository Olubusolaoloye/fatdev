// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract FatAirdrop {
    event Airdropped(address indexed token, address indexed sender, uint256 recipients, uint256 total);

    /// @notice Batch-transfer amounts[i] of token from msg.sender to recipients[i].
    ///         Caller must approve this contract for the sum of all amounts beforehand.
    function airdrop(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        require(recipients.length == amounts.length, "length mismatch");
        require(recipients.length > 0, "empty list");
        IERC20 t = IERC20(token);
        uint256 total = 0;
        for (uint256 i; i < amounts.length; ++i) total += amounts[i];
        require(t.allowance(msg.sender, address(this)) >= total, "insufficient allowance");
        for (uint256 i; i < recipients.length; ++i) {
            require(t.transferFrom(msg.sender, recipients[i], amounts[i]), "transfer failed");
        }
        emit Airdropped(token, msg.sender, recipients.length, total);
    }
}
