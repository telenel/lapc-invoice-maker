import {
  createContext,
  createElement,
  lazy,
  Suspense,
  useContext,
  type ReactNode,
} from "react";
import { createPlugin } from "@fullcalendar/core";
import type { CustomContentGenerator, SpecificViewContentArg } from "@fullcalendar/core";
import type { AgendaStreamViewProps } from "./AgendaStreamView";

export type AgendaStreamIntegrationValue = Pick<
  AgendaStreamViewProps,
  | "displayMonth"
  | "events"
  | "onRefreshEvents"
  | "onEventSelect"
  | "selectedEventId"
  | "showRail"
  | "onNavigateNextWeek"
  | "onNavigatePreviousWeek"
  | "onNavigateToday"
>;

const AgendaStreamIntegrationContext = createContext<AgendaStreamIntegrationValue | null>(null);
const LazyAgendaStreamView = lazy(() =>
  import("./AgendaStreamView").then((module) => ({ default: module.AgendaStreamView })),
);

export function AgendaStreamIntegrationProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: AgendaStreamIntegrationValue;
}) {
  return createElement(
    AgendaStreamIntegrationContext.Provider,
    { value },
    children,
  );
}

function AgendaStreamPluginView({ viewProps }: { viewProps: SpecificViewContentArg }) {
  const integration = useContext(AgendaStreamIntegrationContext);

  return createElement(LazyAgendaStreamView, {
    ...viewProps,
    ...integration,
  });
}

export const agendaStreamViewContent: CustomContentGenerator<SpecificViewContentArg> = (props) =>
  createElement(
    Suspense,
    {
      fallback: createElement(
        "div",
        { className: "flex h-full min-h-[420px] items-center justify-center text-sm text-muted-foreground" },
        "Loading calendar stream...",
      ),
    },
    createElement(AgendaStreamPluginView, { viewProps: props }),
  );

export const agendaStreamPlugin = createPlugin({
  name: "agendaStream",
  views: {
    agendaStreamWeek: {
      type: "timeGrid",
      duration: { weeks: 1 },
      buttonText: "Stream",
      content: agendaStreamViewContent,
    },
  },
});
