import React from 'react';
import { View, Text, ScrollView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/useTheme';
import { touchSlop } from '@/hooks/useA11y';

/**
 * The standard screen shell.
 *
 * docs/20 §6 measured the same boilerplate copied across every screen:
 * `Platform.OS === 'web' ? 67 : insets.top` appeared 12 times, and the
 * `container` / `header` / `backBtn` / `headerTitle` style blocks were
 * reimplemented 6–10 times each.
 *
 * Collapsing it here is not only de-duplication. It is the vehicle for
 * finishing the theme migration (docs/20 F1): this component reads
 * `useTheme()` reactively, so every screen that adopts it inherits working
 * light/dark support without touching its own colour handling. One component
 * fixes sixteen files.
 *
 * It also carries the responsive contract in one place — `contentMaxWidth`
 * stops tablets rendering as stretched phones.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  /** Set false for immersive surfaces (the practice session) that own their layout. */
  constrained = true,
  footer,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  constrained?: boolean;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { c, space, contentMaxWidth } = useTheme();

  // Web has no safe-area insets; these constants match the notch allowance the
  // native builds get, so the two platforms line up visually.
  const top = Platform.OS === 'web' ? 67 : insets.top;
  const bottom = Platform.OS === 'web' ? 34 : insets.bottom;

  const inner = {
    padding: padded ? space.base : 0,
    gap: space.base,
    paddingBottom: bottom + space.xl,
    maxWidth: constrained ? (contentMaxWidth ?? undefined) : undefined,
    width: '100%' as const,
    alignSelf: 'center' as const,
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: top }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[inner, styles.flex]}>{children}</View>
      )}
      {footer}
    </View>
  );
}

/**
 * Back button, title and optional subtitle.
 *
 * The back control is 40pt visually but expanded to the 44pt minimum with
 * `hitSlop` — a child's aim is less precise than the guideline assumes, and an
 * escape route that is hard to hit is the worst control to under-size.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  backLabel = 'Go back',
}: {
  title: string;
  subtitle?: string;
  /** Defaults to router.back(). Pass a function to intercept (e.g. confirm-on-exit). */
  onBack?: () => void;
  right?: React.ReactNode;
  backLabel?: string;
}) {
  const router = useRouter();
  const { c, type, space, touch } = useTheme();

  return (
    <View style={[styles.header, { gap: space.md, marginBottom: space.sm }]}>
      <Feather
        name="arrow-left"
        size={22}
        color={c.text}
        // Rendered as an accessible control rather than a bare icon so screen
        // readers announce it and keyboard users can reach it.
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={() => {
          Haptics.selectionAsync();
          (onBack ?? (() => router.back()))();
        }}
        hitSlop={touchSlop(40)}
        style={{ width: 40, height: 40, textAlign: 'center', lineHeight: 40 }}
        suppressHighlighting
      />
      <View style={styles.grow}>
        <Text style={[type('title'), { color: c.text }]} numberOfLines={2}>{title}</Text>
        {!!subtitle && (
          <Text style={[type('caption'), { color: c.textMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {right ?? <View style={{ width: 40 }} />}
    </View>
  );
}

/** Section label above a group of cards. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  const { c, type, space } = useTheme();
  return (
    <Text style={[type('label'), { color: c.textMuted, marginTop: space.sm }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
});
