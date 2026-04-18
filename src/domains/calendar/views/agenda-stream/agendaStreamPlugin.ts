import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from "react";
import { createPlugin } from "@fullcalendar/core";
import type { CustomContentGenerator, ViewProps } from "@fullcalendar/core";
import { AgendaStreamView, type AgendaStreamViewProps } from "./AgendaStreamView";

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

function AgendaStreamPluginView({ viewProps }: { viewProps: ViewProps }) {
  const integration = useContext(AgendaStreamIntegrationContext);

  return createElement(AgendaStreamView, {
    ...viewProps,
    ...integration,
  });
}

export const agendaStreamViewContent: CustomContentGenerator<ViewProps> = (props) =>
  createElement(AgendaStreamPluginView, { viewProps: props });

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
