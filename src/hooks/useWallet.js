import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, apiGet } from '../lib/apiClient'

export function useWallet({ enabled }) {
    const [wallet, setWallet] = useState(null)
    const [transactions, setTransactions] = useState([])
    const [walletLoading, setWalletLoading] = useState(false)
    const [ledgerLoading, setLedgerLoading] = useState(false)
    const [error, setError] = useState('')

    const refreshWallet = useCallback(async () => {
        if (!enabled) {
            setWallet(null)
            return
        }

        setWalletLoading(true)
        setError('')

        try {
            const data = await apiGet('wallet')
            setWallet(data?.wallet ?? null)
        } catch (requestError) {
            if (requestError instanceof ApiError && requestError.status === 401) {
                setWallet(null)
            } else {
                setError(requestError.message)
            }
        } finally {
            setWalletLoading(false)
        }
    }, [enabled])

    const fetchLedger = useCallback(async (cursor = null) => {
        if (!enabled) {
            setTransactions([])
            return []
        }

        setLedgerLoading(true)
        setError('')

        try {
            const data = await apiGet('ledger', {
                queryParams: {
                    cursor,
                    limit: 30,
                },
            })

            const nextItems = data?.items ?? []
            setTransactions(nextItems)
            return nextItems
        } catch (requestError) {
            setError(requestError.message)
            return []
        } finally {
            setLedgerLoading(false)
        }
    }, [enabled])

    useEffect(() => {
        if (enabled) {
            refreshWallet()
        } else {
            setWallet(null)
            setTransactions([])
        }
    }, [enabled, refreshWallet])

    return useMemo(() => ({
        wallet,
        timedCredits: wallet?.timed_credits ?? 0,
        permanentCredits: wallet?.permanent_credits ?? 0,
        totalCredits: wallet?.total_credits ?? 0,
        dailyCreditQuota: wallet?.daily_credit_quota ?? 0,
        coupons: wallet?.coupons ?? { discount90: 0, discount85: 0 },
        tier: wallet?.tier ?? 'free',
        referralCode: wallet?.referral_code ?? '',
        inviteRedeemed: Boolean(wallet?.invite_redeemed),
        inviteRedeemedAt: wallet?.invite_redeemed_at ?? null,
        transactions,
        walletLoading,
        ledgerLoading,
        error,
        refreshWallet,
        fetchLedger,
    }), [error, fetchLedger, ledgerLoading, refreshWallet, transactions, wallet, walletLoading])
}
