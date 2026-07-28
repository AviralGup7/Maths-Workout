import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/useTheme';
import { t } from '@/i18n/strings';
import type { Lang } from '@/i18n/strings';

/**
 * Persistent bottom navigation.
 *
 * The audit found the app had **no persistent navigation at all** — a pure
 * stack, so every journey restarted from home and a child had no sense of
 * place. Three destinations, because there are three things a learner does:
 * practise, look at their progress, and hand the phone to a grown-up.
 *
 * Rejected alternatives are recorded in docs/17 §3. Briefly: a drawer hides
 * functionality (poor discoverability for children), gesture navigation is
 * undiscoverable for six-year-olds and fails motor accessibility, and five tabs
 * would leave two near-empty while diluting the primary action.
 *
 * Implemented as a component rather than an expo-router `Tabs` layout
 * deliberately: converting the router would touch every route at once, and the
 * migration plan is explicit that no step should be a big-bang rewrite. The UX
 * outcome is identical.
 *
 * Icons are ALWAYS paired with text. An unlabelled icon is guesswork for a
 * child who cannot yet decode abstract symbols.
 */

const TABS = [
  { key: 'practice', route: '/',         icon: 'play-circle' as const, labelKey: 'navPractice' },
  { key: 'progress', route: '/progress', icon: 'trending-up' as const, labelKey: 'navProgress' },
  // docs/28: "Settings" was one of three top-level destinations in an app for
  // six-year-olds — a third of the primary navigation unusable by, and
  // uninteresting to, the actual user. No benchmark does this; settings sit
  // behind a parent-facing entry. Relabelled and pointed at the parent screen,
  // which is where a grown-up actually wants to land.
  { key: 'grownups', route: '/parent', icon: 'users' as const, labelKey: 'navSettings' },
];

/** Routes that take over the screen entirely — no tab bar. */
const IMMERSIVE = ['/game', '/welcome', '/tables-mode', '/mistake-review'];

export function TabBar({ lang }: { lang: Lang }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { c, type, space, touch } = useTheme();

  // A practice session is the one place we WANT tunnel vision. Showing an exit
  // route beside every question invites abandonment mid-thought.
  if (IMMERSIVE.some(r => pathname.startsWith(r))) return null;

  const bottom = Platform.OS === 'web' ? space.sm : Math.max(insets.bottom, space.sm);

  return (
    <View
      style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: c.border,
        backgroundColor: c.surface,
        paddingBottom: bottom,
        paddingTop: space.sm,
      }}
      accessibilityRole="tablist"
    >
      {TABS.map(tab => {
        const active =
          tab.route === '/' ? pathname === '/' : pathname.startsWith(tab.route);
        const tint = active ? c.primary : c.textMuted;
        return (
          <Pressable
            key={tab.key}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync();
              router.push(tab.route as never);
            }}
            style={{
              flex: 1, alignItems: 'center', justifyContent: 'center',
              minHeight: touch.min, gap: 2,
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(tab.labelKey, lang)}
          >
            <Feather name={tab.icon} size={20} color={tint} />
            <Text style={[type('caption'), { color: tint }]}>{t(tab.labelKey, lang)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
