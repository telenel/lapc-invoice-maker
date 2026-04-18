import { createPlugin } from "@fullcalendar/core";
import type { ViewProps } from "@fullcalendar/core";

const AgendaStreamView = ((_props: ViewProps) => null) as unknown as (
  props: ViewProps,
) => null;

export const agendaStreamPlugin = createPlugin({
  name: "agendaStream",
  views: {
    agendaStreamWeek: {
      type: "timeGrid",
      duration: { weeks: 1 },
      buttonText: "Stream",
      content: AgendaStreamView,
    } as any,
  },
});
