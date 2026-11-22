package com.fredkv.planner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        Reminders.show(c, i.getIntExtra("nid", 1), Reminders.CHANNEL,
                i.getStringExtra("title"), i.getStringExtra("text"), i.getStringExtra("page"));
    }
}
