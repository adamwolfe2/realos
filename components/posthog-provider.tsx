"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";

// Tracks route changes as pageviews — must be wrapped in Suspense because of useSearchParams
function PostHogPageView() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const ph = usePostHog();

    useEffect(() => {
        if (!pathname || !ph) return;
        let url = window.origin + pathname;
        const qs = searchParams?.toString();
        if (qs) url += `?${qs}`;
        ph.capture("$pageview", { $current_url: url });
    }, [pathname, searchParams, ph]);

    return null;
}

// Identifies the Clerk user in PostHog and resets on sign-out
function PostHogUserIdentifier() {
    const { user } = useUser();
    const ph = usePostHog();

    useEffect(() => {
        if (!ph) return;
        if (user) {
            ph.identify(user.id, {
                email: user.primaryEmailAddress?.emailAddress ?? undefined,
                name: user.fullName ?? undefined,
                username: user.username ?? undefined,
                created_at: user.createdAt,
            });
        } else {
            ph.reset();
        }
    }, [user, ph]);

    return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
        if (!key) return;
        posthog.init(key, {
            api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
            person_profiles: "identified_only",
            capture_pageview: false, // manual via PostHogPageView
            capture_pageleave: true,
            // Restrict autocapture to buttons and links only — prevents form values, passwords,
            // and other sensitive input data from being captured and sent to PostHog
            autocapture: {
                dom_event_allowlist: ["click"],
                element_allowlist: ["button", "a"],
            },
        });
    }, []);

    return (
        <PHProvider client={posthog}>
            <Suspense fallback={null}>
                <PostHogPageView />
            </Suspense>
            <PostHogUserIdentifier />
            {children}
        </PHProvider>
    );
}
