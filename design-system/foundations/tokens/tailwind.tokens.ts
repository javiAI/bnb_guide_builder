/* ────────────────────────────────────────────────────────────────────
   Warm Analytical Minimalism · tailwind.tokens.ts
   Full Tailwind theme.extend export. All values bridge through CSS
   variables — dark mode flows automatically when [data-theme="dark"].
   ──────────────────────────────────────────────────────────────────── */

export const warmAnalyticalTheme = {
  colors: {
    background: {
      page:     "var(--color-background-page)",
      surface:  "var(--color-background-surface)",
      subtle:   "var(--color-background-subtle)",
      muted:    "var(--color-background-muted)",
      elevated: "var(--color-background-elevated)",
      inverse:  "var(--color-background-inverse)",
      overlay:  "var(--color-background-overlay)",
      scrim:    "var(--color-background-scrim)",
    },
    text: {
      primary:     "var(--color-text-primary)",
      secondary:   "var(--color-text-secondary)",
      muted:       "var(--color-text-muted)",
      subtle:      "var(--color-text-subtle)",
      inverse:     "var(--color-text-inverse)",
      link:        "var(--color-text-link)",
      linkHover:   "var(--color-text-link-hover)",
      disabled:    "var(--color-text-disabled)",
      placeholder: "var(--color-text-placeholder)",
      onAccent:    "var(--color-text-on-accent)",
      onPrimary:   "var(--color-text-on-primary)",
    },
    border: {
      DEFAULT:  "var(--color-border-default)",
      subtle:   "var(--color-border-subtle)",
      strong:   "var(--color-border-strong)",
      emphasis: "var(--color-border-emphasis)",
      focus:    "var(--color-border-focus)",
      error:    "var(--color-border-error)",
      success:  "var(--color-border-success)",
      warning:  "var(--color-border-warning)",
      info:     "var(--color-border-info)",
      inverse:  "var(--color-border-inverse)",
    },
    action: {
      primary:        "var(--color-action-primary)",
      primaryHover:   "var(--color-action-primary-hover)",
      primaryActive:  "var(--color-action-primary-active)",
      primaryFg:      "var(--color-action-primary-fg)",
      primarySubtle:  "var(--color-action-primary-subtle)",
      primarySubtleFg:"var(--color-action-primary-subtle-fg)",
      secondary:        "var(--color-action-secondary)",
      secondaryHover:   "var(--color-action-secondary-hover)",
      secondaryActive:  "var(--color-action-secondary-active)",
      secondaryFg:      "var(--color-action-secondary-fg)",
      ghost:        "var(--color-action-ghost)",
      ghostHover:   "var(--color-action-ghost-hover)",
      ghostActive:  "var(--color-action-ghost-active)",
      ghostFg:      "var(--color-action-ghost-fg)",
      destructive:        "var(--color-action-destructive)",
      destructiveHover:   "var(--color-action-destructive-hover)",
      destructiveActive:  "var(--color-action-destructive-active)",
      destructiveFg:      "var(--color-action-destructive-fg)",
      destructiveSubtle:  "var(--color-action-destructive-subtle)",
    },
    accent: {
      DEFAULT: "var(--color-accent-default)",
      hover:   "var(--color-accent-hover)",
      active:  "var(--color-accent-active)",
      subtle:  "var(--color-accent-subtle)",
      fg:      "var(--color-accent-fg)",
      onFg:    "var(--color-accent-on-fg)",
    },
    interactive: {
      hover:           "var(--color-interactive-hover)",
      active:          "var(--color-interactive-active)",
      selected:        "var(--color-interactive-selected)",
      selectedFg:      "var(--color-interactive-selected-fg)",
      selectedBorder:  "var(--color-interactive-selected-border)",
    },
    focus: { ring: "var(--color-focus-ring)" },
    loading: {
      skeleton: "var(--color-loading-skeleton)",
      shimmer:  "var(--color-loading-shimmer)",
    },
    progress: {
      track: "var(--color-progress-track)",
    },
    disabled: {
      bg:     "var(--color-disabled-bg)",
      fg:     "var(--color-disabled-fg)",
      border: "var(--color-disabled-border)",
    },
    status: {
      success: {
        bg: "var(--color-status-success-bg)", text: "var(--color-status-success-text)",
        icon: "var(--color-status-success-icon)", border: "var(--color-status-success-border)",
        solid: "var(--color-status-success-solid)", solidFg: "var(--color-status-success-solid-fg)",
      },
      warning: {
        bg: "var(--color-status-warning-bg)", text: "var(--color-status-warning-text)",
        icon: "var(--color-status-warning-icon)", border: "var(--color-status-warning-border)",
        solid: "var(--color-status-warning-solid)", solidFg: "var(--color-status-warning-solid-fg)",
      },
      error: {
        bg: "var(--color-status-error-bg)", text: "var(--color-status-error-text)",
        icon: "var(--color-status-error-icon)", border: "var(--color-status-error-border)",
        solid: "var(--color-status-error-solid)", solidFg: "var(--color-status-error-solid-fg)",
      },
      info: {
        bg: "var(--color-status-info-bg)", text: "var(--color-status-info-text)",
        icon: "var(--color-status-info-icon)", border: "var(--color-status-info-border)",
        solid: "var(--color-status-info-solid)", solidFg: "var(--color-status-info-solid-fg)",
      },
      neutral: {
        bg: "var(--color-status-neutral-bg)", text: "var(--color-status-neutral-text)",
        icon: "var(--color-status-neutral-icon)", border: "var(--color-status-neutral-border)",
      },
    },
    chart: {
      1:"var(--color-chart-1)",2:"var(--color-chart-2)",3:"var(--color-chart-3)",4:"var(--color-chart-4)",
      5:"var(--color-chart-5)",6:"var(--color-chart-6)",7:"var(--color-chart-7)",8:"var(--color-chart-8)",
      seq1:"var(--color-chart-seq-1)",seq2:"var(--color-chart-seq-2)",seq3:"var(--color-chart-seq-3)",
      seq4:"var(--color-chart-seq-4)",seq5:"var(--color-chart-seq-5)",
      divNeg3:"var(--color-chart-div-neg-3)",divNeg2:"var(--color-chart-div-neg-2)",divNeg1:"var(--color-chart-div-neg-1)",
      divMid:"var(--color-chart-div-mid)",
      divPos1:"var(--color-chart-div-pos-1)",divPos2:"var(--color-chart-div-pos-2)",divPos3:"var(--color-chart-div-pos-3)",
      grid:"var(--color-chart-grid)", gridStrong:"var(--color-chart-grid-strong)",
      axis:"var(--color-chart-axis)", axisLabel:"var(--color-chart-axis-label)",
      tooltipBg:"var(--color-chart-tooltip-bg)", tooltipFg:"var(--color-chart-tooltip-fg)", tooltipBorder:"var(--color-chart-tooltip-border)",
      bg:"var(--color-chart-bg)",
      positive:"var(--color-chart-positive)", negative:"var(--color-chart-negative)",
      threshold:"var(--color-chart-threshold)", target:"var(--color-chart-target)",
      reference:"var(--color-chart-reference)", projection:"var(--color-chart-projection)",
    },
  },

  fontFamily: {
    sans:  ["var(--font-family-sans)"],
    serif: ["var(--font-family-serif)"],
    mono:  ["var(--font-family-mono)"],
  },

  fontSize: {
    xs:  ["11px", { lineHeight: "16px", fontWeight: "500" }],
    sm:  ["13px", { lineHeight: "18px", fontWeight: "500" }],
    base:["14px", { lineHeight: "20px" }],
    md:  ["15px", { lineHeight: "22px" }],
    lg:  ["17px", { lineHeight: "24px" }],
    xl:  ["20px", { lineHeight: "28px", fontWeight: "500" }],
    "2xl":["24px", { lineHeight: "30px", fontWeight: "500" }],
    "3xl":["30px", { lineHeight: "36px", fontWeight: "500" }],
    "4xl":["38px", { lineHeight: "44px", fontWeight: "500" }],
    "5xl":["48px", { lineHeight: "54px", fontWeight: "500" }],
  },

  fontWeight: {
    regular: "400", medium: "500", semibold: "600", bold: "700",
  },

  letterSpacing: { tight: "-0.015em", normal: "0", wide: "0.04em", caps: "0.08em" },

  spacing: {
    px: "1px", 0.5: "2px",
    1: "4px", 1.5: "6px",
    2: "8px", 2.5: "10px",
    3: "12px", 3.5: "14px",
    4: "16px", 4.5: "18px",
    5: "20px", 6: "24px", 7: "28px", 8: "32px",
    10: "40px", 12: "48px", 14: "56px",
    16: "64px", 20: "80px", 24: "96px", 32: "128px",
  },

  borderRadius: {
    xs:"3px", sm:"5px", md:"8px", lg:"12px",
    xl:"16px", "2xl":"24px", full:"9999px",
  },

  boxShadow: {
    xs: "var(--shadow-xs)", sm: "var(--shadow-sm)", md: "var(--shadow-md)",
    lg: "var(--shadow-lg)", xl: "var(--shadow-xl)", none: "none",
    focus: "var(--shadow-focus)", "focus-error": "var(--shadow-focus-error)",
  },

  transitionDuration: {
    instant: "80ms", fast: "140ms", DEFAULT: "200ms",
    slow: "320ms", slower: "480ms",
  },
  transitionTimingFunction: {
    standard: "cubic-bezier(.2,0,0,1)",
    enter: "cubic-bezier(0,0,0,1)",
    exit: "cubic-bezier(.4,0,1,1)",
    emphasis: "cubic-bezier(.2,.8,.2,1)",
  },

  zIndex: {
    base:"0", raised:"10", sticky:"100", dropdown:"1000",
    overlay:"1040", modal:"1050", popover:"1060",
    tooltip:"1070", toast:"1080",
  },

  height: {
    "btn-sm":"26px","btn-md":"32px","btn-lg":"40px",
    "input-sm":"28px","input-md":"32px","input-lg":"40px",
    "row-compact":"32px","row-cozy":"36px","row-comfortable":"44px",
    topbar:"56px",
  },
  width: {
    "modal-sm":"400px","modal-md":"560px","modal-lg":"720px","modal-xl":"960px",
    sidebar:"240px","sidebar-collapsed":"56px",
  },
  maxWidth: {
    "container-sm":"640px","container-md":"768px","container-lg":"1024px",
    "container-xl":"1280px","container-2xl":"1440px","container-prose":"72ch",
  },
  screens: { sm:"640px", md:"768px", lg:"1024px", xl:"1280px", "2xl":"1440px" },
} as const;

export default warmAnalyticalTheme;
