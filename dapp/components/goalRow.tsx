import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useAccount, useContractRead } from "wagmi";
import { GOALZ_ADDRESS, GOALZ_ABI, USDC_ADDRESS } from "../config/constants";
import { approve, deposit, automateDeposit, setGoal } from "../utils/ethereum";
import { formatTokenAmount } from "../utils/helpers";
import Link from "next/link";
import toast from "react-hot-toast";
import { use } from "chai";

interface GoalData {
    what: string;
    why: string;
    currentAmount: string;
    targetAmount: string;
    targetDate: string;
    depositToken: string;
    depositTokenSymbol: string;
    automatedDepositAmount: "",
    automatedDepositDate: "",
};

const GoalRow = ({ goalIndex }) => {

    const { address } = useAccount();
    const [isExpandedDeposit, setIsExpandedDeposit] = useState(false);
    const [isExpandedAutomate, setIsExpandedAutomate] = useState(false);
    const [depositAmount, setDepositAmount] = useState("");
    const [autoDepositAmount, setAutoDepositAmount] = useState("");
    const [autoDepositFrequency, setAutoDepositFrequency] = useState("");
    const [goalProgress, setGoalProgress] = useState(0);
    const [isDepositLoading, setIsDepositLoading] = useState(false);
    const [isApproveLoading, setIsApproveLoading] = useState(false);
    const [isAutomateDepositLoading, setIsAutomateDepositLoading] = useState(false);
    const [goalData, setGoalData] = useState<GoalData>({
        what: "",
        why: "",
        currentAmount: "",
        targetAmount: "",
        targetDate: "",
        depositToken: "",
        depositTokenSymbol: "",
        automatedDepositAmount: "",
        automatedDepositDate: "",
    });

    // Get Goal Data
    const goal = useContractRead({
        addressOrName: GOALZ_ADDRESS,
        contractInterface: GOALZ_ABI,
        functionName: "savingsGoals",
        args: [goalIndex],
        watch: true,
    });

    const automatedDeposit = useContractRead({
        addressOrName: GOALZ_ADDRESS,
        contractInterface: GOALZ_ABI,
        functionName: "automatedDeposits",
        args: [goalIndex],
        watch: true,
    });

    // ---
    // Format the goal data
    useEffect(() => {
        if (goal.data) {
            const targetDate = new Date(goal.data.targetDate.mul(1000).toNumber());
            const goalProgress = goal.data.currentAmount.mul(100).div(goal.data.targetAmount).toNumber();
            let depositTokenSymbol = "";
            if (goal.data.depositToken == USDC_ADDRESS) {
                depositTokenSymbol = "USDC";
            } else {
                depositTokenSymbol = "WETH";
            }
            setGoalProgress(goalProgress);

            // Update the goal data state to add the goal data 
            setGoalData((prevGoalData) => ({
                ...prevGoalData,
                what: goal.data[0],
                why: goal.data[1],
                currentAmount: formatTokenAmount(goal.data[2], 18, 0),
                depositToken: goal.data.depositToken,
                depositTokenSymbol: depositTokenSymbol,
                targetAmount: formatTokenAmount(goal.data[3], 18, 0),
                targetDate: formatDate(targetDate)
            }));
        }
    }, [goal.data]);

    useEffect(() => {
        if (automatedDeposit.data && !automatedDeposit.error) {
            if (automatedDeposit.data.amount.gt(0)) {
                console.log("automatedDeposit.data", automatedDeposit.data);
                const nextDepositTimestamp = automatedDeposit.data.lastDeposit.add(automatedDeposit.data.frequency).mul(1000);
                const automatedDepositDate = new Date(nextDepositTimestamp.toNumber());

                // Update the goal data state to add the goal data 
                setGoalData((prevGoalData) => ({
                    ...prevGoalData,
                    automatedDepositAmount: formatTokenAmount(automatedDeposit.data.amount, 18, 0),
                    automatedDepositDate: formatDate(automatedDepositDate),
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
            await deposit(goalIndex, ethers.utils.parseUnits(amount, 18));
            toast.success(`Deposited ${amount} toward ${goalData.what}!`);
        } catch (error) {
            console.log("deposit error:", error);
            toast.error('Deposit error.');
        } finally {
            setIsDepositLoading(false);
        }

    }

    const handleApprove = async () => {
        // Get the amount to deposit
        const amount = (document.getElementById(`deposit-amount-${goalIndex}`) as HTMLInputElement).value;

        // Try to approve the goalz contract to spend the amount
        try {
            setIsApproveLoading(true);
            await approve(goalData.depositToken);
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
        // Get the amount and frequency
        const frequencySeconds = ethers.BigNumber.from(autoDepositFrequency).mul(ethers.BigNumber.from(24).mul(60).mul(60));

        // Try to automate the deposit
        try {
            setIsAutomateDepositLoading(true);
            await automateDeposit(goalIndex, ethers.utils.parseUnits(autoDepositAmount, 18), frequencySeconds);
            toast.success(`Automated deposit of ${autoDepositAmount} every ${autoDepositFrequency} days.`);
        } catch (error) {
            console.log("automateDeposit error:", error);
            toast.error('Error automating deposit.');
        } finally {
            setIsAutomateDepositLoading(false);
        }
    }

    return (
        <>
            <tr key={`${goalIndex}`}>
                <td>{goalData.why} {goalData.what}</td>
                <td>
                    <div className="progress">
                        <div className="progress-bar" role="progressbar" style={{ width: `${goalProgress}%` }}></div>
                    </div>
                </td>
                <td>{goalData.targetAmount} / {goalData.currentAmount} {goalData.depositTokenSymbol}</td>
                <td>{goalData.targetDate}</td>

                {/* if theres an automatedDepositAmount > 0 then display this otherwise display a link to automateDeposit */}
                <td>
                    <Link href="">
                        <button className="btn btn-outline-primary btn-sm" onClick={toggleExpansionDeposit} type="button">Deposit</button>
                    </Link>
                    &nbsp; &nbsp;
                    {goalData.automatedDepositAmount > 0 ? (
                        <>🤖 {goalData.automatedDepositAmount} USDC on {goalData.automatedDepositDate}</>
                    ) : (
                        <Link href="">
                            {/* a small button to automate it */}
                            <button className="btn btn-outline-primary btn-sm" onClick={toggleExpansionAutomate} type="button">Automate</button>
                        </Link>
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
                                <button
                                    className="btn btn-outline-primary"
                                    type="button"
                                    id={`deposit-button-${goalIndex}`}
                                    onClick={handleDeposit}>Deposit</button>
                                <button
                                    className="btn btn-outline-success"
                                    type="button"
                                    id={`approve-button-${goalIndex}`}
                                    onClick={handleApprove}>Approve</button>
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
                                <label className="form-label" htmlFor={`deposit-amount-${goalIndex}`}>Amount</label>
                                <div className="input-group mb-3">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id={`auto-deposit-amount-${goalIndex}`}
                                        value={autoDepositAmount}
                                        onChange={(e) => setAutoDepositAmount(e.target.value)}
                                        placeholder="0" />
                                    <br />
                                    <span className="input-group-text">USDC</span>
                                </div>
                                <label className="form-label" htmlFor="{`deposit-frequency-${goalIndex}`}">Frequency</label>
                                <div className="input-group mb-3">
                                    <input
                                        width={100}
                                        type="number"
                                        className="form-control"
                                        id={`deposit-frequency-${goalIndex}`}
                                        value={autoDepositFrequency}
                                        onChange={(e) => setAutoDepositFrequency(e.target.value)}
                                        placeholder="0" />
                                    <span className="input-group-text">Days</span>
                                </div>
                                <div className="input-group mb-3">
                                    <button
                                        className="btn btn-outline-secondary"
                                        type="button"
                                        id="button-addon2"
                                        onClick={handleAutomateDeposit}>Automate</button>
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
