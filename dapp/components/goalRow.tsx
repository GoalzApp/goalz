import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useAccount, useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { GOALZ_ABI, ERC20_ABI, getNetworkAddresses } from "../config/constants";
import { useDeposit, useCancelAutomatedDeposit, useWithdraw, useAutomateDeposit, useContractApprove } from "../utils/ethereum";
import { formatTokenAmount } from "../utils/helpers";
import Link from "next/link";
import toast from "react-hot-toast";
import { Address } from "viem";
import { formatEther } from "ethers/lib/utils";
import { useTransactionReceipt } from 'wagmi'

function ensureHexFormat(value: string): `0x${string}` {
    if (!value.startsWith("0x")) {
        return `0x${value}` as `0x${string}`;
    }
    return value as `0x${string}`;
}


interface GoalData {
    what: string;
    why: string;
    currentAmount: string;
    targetAmount: string;
    targetDate: string;
    depositToken: Address;
    depositTokenSymbol: string;
    automatedDepositAmount: any;
    automatedDepositDate: string;
    completed: boolean;
};

const GoalRow = ({ goalIndex }: { goalIndex: any }) => {
    const { address, chain } = useAccount();
    const [goalId, setGoalId] = useState(0);
    const [isExpandedDeposit, setIsExpandedDeposit] = useState(false);
    const [isExpandedAutomate, setIsExpandedAutomate] = useState(false);
    const [depositAmount, setDepositAmount] = useState("");
    const [autoDepositAmount, setAutoDepositAmount] = useState("");
    const [autoDepositFrequency, setAutoDepositFrequency] = useState("");
    const [frequencyUnit, setFrequencyUnit] = useState("days");
    const [goalProgress, setGoalProgress] = useState(0);
    const [isDepositLoading, setIsDepositLoading] = useState(false);
    const [isApproveLoading, setIsApproveLoading] = useState(false);
    const [isAutomateDepositLoading, setIsAutomateDepositLoading] = useState(false);
    const [isWithdrawLoading, setIsWithdrawLoading] = useState(false);
    const [isCancelAutomateLoading, setIsCancelAutomateLoading] = useState(false);
    const [isAllowed, setIsAllowed] = useState(false);
    const [goalData, setGoalData] = useState<GoalData>({
        what: "",
        why: "",
        currentAmount: "",
        targetAmount: "",
        targetDate: "",
        depositToken: "0x0000000000000000000000000000000000000000" as Address,
        depositTokenSymbol: "",
        automatedDepositAmount: "",
        automatedDepositDate: "",
        completed: false,
    });

    const automateDeposit = useAutomateDeposit();
    const approve = useContractApprove();
    const cancelAutomatedDeposit = useCancelAutomatedDeposit();
    const deposit = useDeposit();
    const withdraw = useWithdraw();

    const addresses = chain ? getNetworkAddresses(chain.id) : {};

    // Get Goal Data
    const goal = useReadContract({
        address: addresses.GOALZ_ADDRESS,
        abi: GOALZ_ABI,
        functionName: "savingsGoals",
        args: [goalId],
    });

    const goalTokenData = useReadContract({
        address: addresses.GOALZ_ADDRESS,
        abi: GOALZ_ABI,
        functionName: "tokenOfOwnerByIndex",
        args: [address, goalIndex],
    });

    useEffect(() => {
        if (goalTokenData.data) {
            setGoalId(ethers.BigNumber.from(goalTokenData.data));
        }
    }, [goalTokenData.data]);

    const automatedDeposit = useReadContract({
        address: addresses.GOALZ_ADDRESS,
        abi: GOALZ_ABI,
        functionName: "automatedDeposits",
        args: [goalId],
    });

    const allowance = useReadContract({
        address: goalData.depositToken,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, addresses.GOALZ_ADDRESS],
    });

    useEffect(() => {
        if (allowance.data) {
            if (ethers.BigNumber.from(allowance.data).gt(0)) {
                setIsAllowed(true);
            } else {
                setIsAllowed(false);
            }
        }
    }, [allowance.data]);
    // ---
    // Format the goal data
    useEffect(() => {
        if (goal.data) {
            const gData = goal.data as any;
            const targetDate = new Date(Number(gData[4]) * 1000);
            const goalProgress = ethers.BigNumber.from(gData[2]).isZero()
                ? 0
                : ethers.BigNumber.from(gData[3]).mul(100).div(ethers.BigNumber.from(gData[2])).toNumber();
            let depositTokenSymbol = "";
            if (gData[5] == addresses.USDC_ADDRESS) {
                depositTokenSymbol = "USDC";
            } else {
                depositTokenSymbol = "WETH";
            }
            setGoalProgress(goalProgress);

            let currentAmount = '0';
            let targetAmount = '0';
            let decimals = 18;
            if (gData[5] == addresses.USDC_ADDRESS) {
                decimals = 6;
                currentAmount = formatTokenAmount(gData[3], decimals, 0);
                targetAmount = formatTokenAmount(gData[2], decimals, 0);
            } else {
                currentAmount = formatTokenAmount(gData[3], decimals, 3);
                targetAmount = formatTokenAmount(gData[2], decimals, 3);
            }

            // Update the goal data state to add the goal data
            setGoalData((prevGoalData) => ({
                ...prevGoalData,
                what: gData[0],
                why: gData[1],
                currentAmount: currentAmount,
                depositToken: gData[5],
                depositTokenSymbol: depositTokenSymbol,
                targetAmount: targetAmount,
                targetDate: formatDate(targetDate),
                completed: gData[6],
            }));
            console.log("goal data", goalData);
        }
    }, [goal.data]);

    useEffect(() => {
        if (automatedDeposit.data && !automatedDeposit.error) {
            const automatedDepositData = automatedDeposit.data as any;
            if (automatedDepositData[0]) {
                const automatedDepositDate = new Date(Number(automatedDepositData[2]) * 1000);
                let decimals = 18;
                if (goalData.depositToken == addresses.USDC_ADDRESS) {
                    decimals = 6;
                }

                // Update the goal data state to add the goal data
                setGoalData((prevGoalData) => ({
                    ...prevGoalData,
                    automatedDepositAmount: formatTokenAmount(automatedDepositData[0], 6, 0),
                    automatedDepositDate: formatDate(automatedDepositDate),
                }));
            } else {
                // No automated deposit
                setGoalData((prevGoalData) => ({
                    ...prevGoalData,
                    automatedDepositAmount: "",
                    automatedDepositDate: "",
                }));
            }
        }
    }, [automatedDeposit.data]);

    // ---
    // Format a date
    const formatDate = (date: Date) => {
        return date.toLocaleString("en", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).toString();
    };

    // Function to toggle the expansion of the row
    const toggleExpansionDeposit = () => {
        setIsExpandedDeposit(!isExpandedDeposit);
    };

    const toggleExpansionAutomate = () => {
        setIsExpandedAutomate(!isExpandedAutomate);
    };

    // ---
    // Handle depositing funds into a goal
    const handleDeposit = async () => {
        // Get the amount to deposit
        const amount = (document.getElementById(`deposit-amount-${goalIndex}`) as HTMLInputElement).value;

        // Try to make a deposit to this goalIndex
        try {
            setIsDepositLoading(true);
            if (goalData.depositToken == addresses.USDC_ADDRESS) {
                await deposit(ethers.BigNumber.from(goalId), ethers.utils.parseUnits(amount, 6), addresses.GOALZ_ADDRESS);
            } else {
                await deposit(ethers.BigNumber.from(goalId), ethers.utils.parseUnits(amount, 18), addresses.GOALZ_ADDRESS);
            }
            toast.success(`Deposited ${amount} toward ${goalData.what}!`);
        } catch (error) {
            console.log("deposit error:", error);
            toast.error('Deposit error.');
        } finally {
            setIsDepositLoading(false);
            setIsExpandedDeposit(false);
        }
    }

    const handleApprove = async () => {
        // Get the amount to deposit
        const amount = (document.getElementById(`deposit-amount-${goalIndex}`) as HTMLInputElement).value;
        // Try to approve the goalz contract to spend the amount
        console.log(ethers.utils.parseUnits(amount, 18));
        try {
            setIsApproveLoading(true);
            await approve(goalData.depositToken, addresses.GOALZ_ADDRESS);
            toast.success('Approved!');
        } catch (error) {
            console.log("approve error:", error);
        } finally {
            setIsApproveLoading(false);
        }
    }

    // ---
    // Handler for automateDeposit
    const handleAutomateDeposit = async () => {
        // Convert the frequency based on the selected unit
        let frequencySeconds;
        switch (frequencyUnit) {
            case "minutes":
                frequencySeconds = ethers.BigNumber.from(autoDepositFrequency).mul(60);
                break;
            case "hours":
                frequencySeconds = ethers.BigNumber.from(autoDepositFrequency).mul(3600);
                break;
            case "days":
                frequencySeconds = ethers.BigNumber.from(autoDepositFrequency).mul(86400);
                break;
            case "weeks":
                frequencySeconds = ethers.BigNumber.from(autoDepositFrequency).mul(604800);
                break;
            case "months":
                frequencySeconds = ethers.BigNumber.from(autoDepositFrequency).mul(2592000); // Approximation
                break;
            default:
                frequencySeconds = ethers.BigNumber.from(autoDepositFrequency).mul(86400); // Default to days
        }

        // Try to automate the deposit
        try {
            setIsAutomateDepositLoading(true);
            let decimals = 18;
            if (goalData.depositToken == addresses.USDC_ADDRESS) {
                decimals = 6;
            }
            await automateDeposit(ethers.BigNumber.from(goalId), ethers.utils.parseUnits(autoDepositAmount, decimals), frequencySeconds, addresses.GOALZ_ADDRESS);
            toast.success(`Automated deposit of ${autoDepositAmount} every ${autoDepositFrequency} ${frequencyUnit}.`);
        } catch (error) {
            console.log("automateDeposit error:", error);
            toast.error('Error automating deposit.');
        } finally {
            setIsAutomateDepositLoading(false);
            setIsExpandedAutomate(false);
        }
    }

    // Handler for withdraw
    const handleWithdraw = async () => {
        // Try to withdraw
        try {
            setIsWithdrawLoading(true);
            console.log(goalIndex)
            await withdraw(ethers.BigNumber.from(goalId), addresses.GOALZ_ADDRESS);
            toast.success(`Withdrew ${goalData.currentAmount} from ${goalData.what}!`);
        } catch (error) {
            console.log("withdraw error:", error);
            toast.error('Error withdrawing.');
        } finally {
            setIsWithdrawLoading(false);
        }
    }

    // Handler for canceling automated deposit
    const handleCancelAutomate = async () => {
        // Try to cancel automated deposit
        try {
            setIsCancelAutomateLoading(true);

            await cancelAutomatedDeposit(ethers.BigNumber.from(goalId), addresses.GOALZ_ADDRESS);
            toast.success(`Canceled automated deposit for ${goalData.what}!`);
            // Update the UI state
            setGoalData((prevGoalData) => ({
                ...prevGoalData,
                automatedDepositAmount: "",
                automatedDepositDate: "",
            }));
        } catch (error) {
            console.log("cancel automate error:", error);
            toast.error('Error canceling automated deposit.');
        } finally {
            setIsCancelAutomateLoading(false);
        }
    }

    return (
        <>
            <tr key={`${goalIndex}`}>
                <td>{goalData.why} {goalData.what}</td>
                <td>
                    {goalData.completed ? (
                        <span>🏆</span>
                    ) : (
                        <div className="progress">
                            <div className="progress-bar" role="progressbar" style={{ width: `${goalProgress}%` }}></div>
                        </div>
                    )}
                </td>
                <td>{goalData.completed ? (
                    <span>{goalData.targetAmount} {goalData.depositTokenSymbol}</span>
                ) : (
                    <span>{goalData.currentAmount} / {goalData.targetAmount} {goalData.depositTokenSymbol}</span>
                )}</td>
                <td>{goalData.targetDate}</td>
                <td>
                    {goalData.completed ? (
                        <></>
                    ) : (
                        <>
                            <Link href="">
                                <button className="btn btn-outline-success btn-sm" onClick={toggleExpansionDeposit} type="button">Deposit</button>
                            </Link>
                        </>
                    )}
                    &nbsp; &nbsp;
                    {Number(goalData.currentAmount) != 0 ? (
                        <Link href="">
                            <button className="btn btn-outline-danger btn-sm" type="button" onClick={handleWithdraw}>
                                {isWithdrawLoading ? (
                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                ) : (
                                    'Withdraw'
                                )}
                            </button>
                        </Link>
                    ) : (
                        <></>
                    )}
                    {goalData.completed ? (
                        <></>
                    ) : (
                        <>
                            &nbsp; &nbsp;
                            {goalData.automatedDepositAmount.toString() != "" ? (
                                <>
                                    <Link href="">
                                        <button className="btn btn-outline-warning btn-sm" onClick={handleCancelAutomate} type="button">
                                            {isCancelAutomateLoading ? (
                                                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                            ) : (
                                                'Cancel'
                                            )}
                                        </button>
                                    </Link>
                                    &nbsp; &nbsp;
                                    🤖 {goalData.automatedDepositAmount} {goalData.depositTokenSymbol} on {goalData.automatedDepositDate}

                                </>
                            ) : (
                                <Link href="">
                                    <button className="btn btn-outline-primary btn-sm" onClick={toggleExpansionAutomate} type="button">Automate</button>
                                </Link>
                            )}
                            &nbsp; &nbsp;
                        </>
                    )}
                </td>
            </tr>
            {isExpandedDeposit && (
                <tr key={`actions-${goalIndex}`}>
                    <td colSpan={4}></td>
                    <td colSpan={1}>
                        <div>
                            <strong>One-time Deposit</strong>
                            <div className="input-group mb-3">
                                <input
                                    type="number"
                                    className="form-control"
                                    id={`deposit-amount-${goalIndex}`}
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                    placeholder="0" />
                                <span className="input-group-text">{goalData.depositTokenSymbol}</span>
                            </div>
                            <div className="btn-group" role="group">
                                {isAllowed ? (
                                    <button
                                        className="btn btn-outline-primary"
                                        type="button"
                                        id={`deposit-button-${goalIndex}`}
                                        onClick={handleDeposit}>
                                        {isDepositLoading ? (
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        ) : (
                                            'Deposit'
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        className="btn btn-outline-success"
                                        type="button"
                                        id={`approve-button-${goalIndex}`}
                                        onClick={handleApprove}>
                                        {isApproveLoading ? (
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        ) : (
                                            'Approve'
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
            {isExpandedAutomate && (
                <tr>
                    <td colSpan={4}></td>
                    <td colSpan={1}>
                        <br />
                        <div>
                            <strong>Automate Deposit</strong>
                            <div className="form-group">
                                <label className="form-label" htmlFor={`deposit-frequency-${goalIndex}`}>Deposit {autoDepositAmount} {goalData.depositTokenSymbol} every {autoDepositFrequency} {frequencyUnit} </label>
                                <div className="input-group mb-3">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id={`auto-deposit-amount-${goalIndex}`}
                                        value={autoDepositAmount}
                                        onChange={(e) => setAutoDepositAmount(e.target.value)}
                                        placeholder="0" />
                                    <span className="input-group-text">{goalData.depositTokenSymbol}</span>
                                </div>
                                <div className="input-group mb-3">
                                    <input
                                        width={100}
                                        type="number"
                                        className="form-control"
                                        id={`deposit-frequency-${goalIndex}`}
                                        value={autoDepositFrequency}
                                        onChange={(e) => setAutoDepositFrequency(e.target.value)}
                                        placeholder="0" />
                                    <select
                                        className="form-select"
                                        id={`frequency-unit-${goalIndex}`}
                                        value={frequencyUnit}
                                        onChange={(e) => setFrequencyUnit(e.target.value)}
                                    >
                                        <option value="minutes">Minutes</option>
                                        <option value="hours">Hours</option>
                                        <option value="days">Days</option>
                                        <option value="weeks">Weeks</option>
                                        <option value="months">Months</option>
                                    </select>
                                </div>
                                <div className="input-group mb-3">
                                    <button
                                        className="btn btn-outline-secondary"
                                        type="button"
                                        id="button-addon2"
                                        onClick={handleAutomateDeposit}>
                                        {isAutomateDepositLoading ? (
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        ) : (
                                            'Automate'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

export default GoalRow;
