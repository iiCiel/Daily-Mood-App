const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const FALLBACK_PACKAGE = 'com.iiciel.moodjournal';

const RECEIVERS = [
  {
    className: 'DailyMoodTasksWidgetProvider',
    label: 'Daily Mood Tasks',
    xml: 'widget_tasks_info',
  },
  {
    className: 'DailyMoodMoodWidgetProvider',
    label: 'Daily Mood',
    xml: 'widget_mood_info',
  },
  {
    className: 'DailyMoodPomodoroWidgetProvider',
    label: 'Daily Mood Focus',
    xml: 'widget_pomodoro_info',
  },
];

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function withWidgetReceivers(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) return mod;

    const receiverNames = new Set(RECEIVERS.map((receiver) => `.widgets.${receiver.className}`));
    application.receiver = (application.receiver || []).filter((receiver) => {
      const name = receiver?.$?.['android:name'];
      return !receiverNames.has(name);
    });

    for (const receiver of RECEIVERS) {
      application.receiver.push({
        $: {
          'android:name': `.widgets.${receiver.className}`,
          'android:exported': 'true',
          'android:label': receiver.label,
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': `@xml/${receiver.xml}`,
            },
          },
        ],
      });
    }

    return mod;
  });
}

function javaUtils(packageName) {
  return `package ${packageName}.widgets;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.net.Uri;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

class DailyMoodWidgetUtils {
  static class TaskSummary {
    int open = 0;
    int due = 0;
    String[] tasks = new String[4];
    boolean[] overdue = new boolean[4];
    int taskCount = 0;
  }

  static class MoodSummary {
    boolean logged = false;
    int mood = 0;
    double weekAverage = 0;
    int weekCount = 0;
  }

  static class FocusSummary {
    int minutes = 0;
    int sessions = 0;
    String nextTask = "Ready for a focus block";
  }

  static PendingIntent openApp(Context context, String path, int requestCode) {
    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("mood-journal://" + path));
    intent.setPackage(context.getPackageName());
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    return PendingIntent.getActivity(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
  }

  static TaskSummary loadTaskSummary(Context context) {
    TaskSummary summary = new TaskSummary();
    SQLiteDatabase db = openDatabase(context);
    if (db == null) return summary;
    Cursor cursor = null;
    try {
      // Total open task count
      cursor = db.rawQuery(
        "SELECT COUNT(*) FROM tasks t " +
          "LEFT JOIN task_lists l ON l.id = t.list_id " +
          "LEFT JOIN projects p ON p.id = t.project_id " +
          "WHERE t.completed = 0 AND (l.archived = 0 OR l.id IS NULL) AND (p.archived = 0 OR p.id IS NULL)",
        null
      );
      if (cursor.moveToFirst()) summary.open = cursor.getInt(0);
      close(cursor);

      // Due today / overdue count
      cursor = db.rawQuery(
        "SELECT COUNT(*) FROM tasks t " +
          "LEFT JOIN task_lists l ON l.id = t.list_id " +
          "LEFT JOIN projects p ON p.id = t.project_id " +
          "WHERE t.completed = 0 AND t.due_date IS NOT NULL AND t.due_date <= ? " +
          "AND (l.archived = 0 OR l.id IS NULL) AND (p.archived = 0 OR p.id IS NULL)",
        new String[] { today() }
      );
      if (cursor.moveToFirst()) summary.due = cursor.getInt(0);
      close(cursor);

      // Top 4 tasks: overdue first, then in-progress, then by due date, then position
      cursor = db.rawQuery(
        "SELECT t.title, " +
          "CASE WHEN t.due_date IS NOT NULL AND t.due_date <= ? THEN 1 ELSE 0 END AS is_overdue " +
          "FROM tasks t " +
          "LEFT JOIN task_lists l ON l.id = t.list_id " +
          "LEFT JOIN projects p ON p.id = t.project_id " +
          "WHERE t.completed = 0 AND (l.archived = 0 OR l.id IS NULL) AND (p.archived = 0 OR p.id IS NULL) " +
          "ORDER BY " +
          "  CASE WHEN t.due_date IS NOT NULL AND t.due_date <= ? THEN 0 ELSE 1 END, " +
          "  CASE WHEN t.status = 'doing' THEN 0 ELSE 1 END, " +
          "  CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, " +
          "  t.due_date ASC, t.position ASC " +
          "LIMIT 4",
        new String[] { today(), today() }
      );
      while (cursor.moveToNext() && summary.taskCount < 4) {
        summary.tasks[summary.taskCount] = cursor.getString(0);
        summary.overdue[summary.taskCount] = cursor.getInt(1) == 1;
        summary.taskCount++;
      }
    } catch (Exception ignored) {
    } finally {
      close(cursor);
      close(db);
    }
    return summary;
  }

  static MoodSummary loadMoodSummary(Context context) {
    MoodSummary summary = new MoodSummary();
    SQLiteDatabase db = openDatabase(context);
    if (db == null) return summary;
    Cursor cursor = null;
    try {
      cursor = db.rawQuery("SELECT mood FROM entries WHERE date = ? LIMIT 1", new String[] { today() });
      if (cursor.moveToFirst()) {
        summary.logged = true;
        summary.mood = cursor.getInt(0);
      }
      close(cursor);

      cursor = db.rawQuery(
        "SELECT AVG(mood), COUNT(*) FROM entries WHERE date >= ?",
        new String[] { daysAgo(6) }
      );
      if (cursor.moveToFirst()) {
        summary.weekAverage = cursor.isNull(0) ? 0 : cursor.getDouble(0);
        summary.weekCount = cursor.getInt(1);
      }
    } catch (Exception ignored) {
    } finally {
      close(cursor);
      close(db);
    }
    return summary;
  }

  static FocusSummary loadFocusSummary(Context context) {
    FocusSummary summary = new FocusSummary();
    SQLiteDatabase db = openDatabase(context);
    if (db == null) return summary;
    Cursor cursor = null;
    try {
      cursor = db.rawQuery(
        "SELECT SUM(duration), COUNT(*) FROM pomodoro_sessions WHERE completed = 1 AND date = ?",
        new String[] { today() }
      );
      if (cursor.moveToFirst()) {
        summary.minutes = cursor.isNull(0) ? 0 : cursor.getInt(0);
        summary.sessions = cursor.getInt(1);
      }
      close(cursor);

      cursor = db.rawQuery(
        "SELECT title FROM tasks WHERE completed = 0 ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, position ASC LIMIT 1",
        null
      );
      if (cursor.moveToFirst()) summary.nextTask = cursor.getString(0);
    } catch (Exception ignored) {
    } finally {
      close(cursor);
      close(db);
    }
    return summary;
  }

  static String moodLabel(int mood) {
    switch (mood) {
      case 1: return "Low";
      case 2: return "Heavy";
      case 3: return "Okay";
      case 4: return "Good";
      case 5: return "Great";
      default: return "Not logged";
    }
  }

  static String averageLabel(double value) {
    if (value <= 0) return "No week data yet";
    return String.format(Locale.US, "7-day avg %.1f", value);
  }

  private static SQLiteDatabase openDatabase(Context context) {
    File[] candidates = new File[] {
      context.getDatabasePath("mood_journal.db"),
      new File(context.getFilesDir(), "SQLite/mood_journal.db"),
      new File(context.getFilesDir(), "SQLite/mood_journal.db.db"),
      new File(context.getNoBackupFilesDir(), "SQLite/mood_journal.db")
    };
    for (File file : candidates) {
      try {
        if (file != null && file.exists()) {
          return SQLiteDatabase.openDatabase(file.getPath(), null, SQLiteDatabase.OPEN_READONLY);
        }
      } catch (Exception ignored) {}
    }
    return null;
  }

  private static String today() {
    return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
  }

  private static String daysAgo(int days) {
    Calendar calendar = Calendar.getInstance();
    calendar.add(Calendar.DATE, -days);
    return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(calendar.getTime());
  }

  private static void close(Cursor cursor) {
    try {
      if (cursor != null) cursor.close();
    } catch (Exception ignored) {}
  }

  private static void close(SQLiteDatabase db) {
    try {
      if (db != null) db.close();
    } catch (Exception ignored) {}
  }
}
`;
}

function javaTasksProvider(packageName) {
  return `package ${packageName}.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

import ${packageName}.R;

public class DailyMoodTasksWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    for (int appWidgetId : appWidgetIds) update(context, appWidgetManager, appWidgetId);
  }

  static void update(Context context, AppWidgetManager manager, int id) {
    DailyMoodWidgetUtils.TaskSummary summary = DailyMoodWidgetUtils.loadTaskSummary(context);
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_tasks);

    // Header count badge
    String countText = summary.due > 0
      ? summary.due + (summary.due == 1 ? " due" : " due")
      : summary.open + (summary.open == 1 ? " open" : " open");
    views.setTextViewText(R.id.widgetCount, countText);

    // Task rows: show up to 4 tasks, hide the rest
    int[] rowIds = { R.id.widgetTask1Row, R.id.widgetTask2Row, R.id.widgetTask3Row, R.id.widgetTask4Row };
    int[] textIds = { R.id.widgetTask1, R.id.widgetTask2, R.id.widgetTask3, R.id.widgetTask4 };
    int[] dotIds  = { R.id.widgetTask1Dot, R.id.widgetTask2Dot, R.id.widgetTask3Dot, R.id.widgetTask4Dot };

    for (int i = 0; i < 4; i++) {
      if (i < summary.taskCount) {
        views.setViewVisibility(rowIds[i], android.view.View.VISIBLE);
        views.setTextViewText(textIds[i], summary.tasks[i]);
        // Overdue = red dot, in-progress/normal = primary blue
        int dotColor = summary.overdue[i] ? 0xFFEF4444 : 0xFF2563EB;
        views.setTextColor(dotIds[i], dotColor);
      } else {
        views.setViewVisibility(rowIds[i], android.view.View.GONE);
      }
    }

    // Empty state
    views.setViewVisibility(
      R.id.widgetEmpty,
      summary.taskCount == 0 ? android.view.View.VISIBLE : android.view.View.GONE
    );

    // Tap anywhere → open tasks tab
    views.setOnClickPendingIntent(R.id.widgetRoot,   DailyMoodWidgetUtils.openApp(context, "tasks", 301));
    views.setOnClickPendingIntent(R.id.widgetAction, DailyMoodWidgetUtils.openApp(context, "tasks", 302));

    manager.updateAppWidget(id, views);
  }
}
`;
}

function javaMoodProvider(packageName) {
  return `package ${packageName}.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

import ${packageName}.R;

public class DailyMoodMoodWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    for (int appWidgetId : appWidgetIds) update(context, appWidgetManager, appWidgetId);
  }

  static void update(Context context, AppWidgetManager manager, int id) {
    DailyMoodWidgetUtils.MoodSummary summary = DailyMoodWidgetUtils.loadMoodSummary(context);
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_mood);
    views.setTextViewText(R.id.widgetTitle, summary.logged ? DailyMoodWidgetUtils.moodLabel(summary.mood) : "Log mood");
    views.setTextViewText(R.id.widgetValue, summary.logged ? summary.mood + "/5 today" : "How are you?");
    views.setTextViewText(R.id.widgetDetail, summary.weekCount > 0 ? DailyMoodWidgetUtils.averageLabel(summary.weekAverage) : "Start today's entry.");
    views.setOnClickPendingIntent(R.id.widgetRoot, DailyMoodWidgetUtils.openApp(context, "mood", 401));
    views.setOnClickPendingIntent(R.id.widgetAction, DailyMoodWidgetUtils.openApp(context, "entry", 402));
    manager.updateAppWidget(id, views);
  }
}
`;
}

function javaPomodoroProvider(packageName) {
  return `package ${packageName}.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

import ${packageName}.R;

public class DailyMoodPomodoroWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    for (int appWidgetId : appWidgetIds) update(context, appWidgetManager, appWidgetId);
  }

  static void update(Context context, AppWidgetManager manager, int id) {
    DailyMoodWidgetUtils.FocusSummary summary = DailyMoodWidgetUtils.loadFocusSummary(context);
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_pomodoro);
    views.setTextViewText(R.id.widgetTitle, "25:00 ready");
    views.setTextViewText(R.id.widgetValue, summary.minutes + " min today");
    views.setTextViewText(R.id.widgetDetail, summary.sessions + " sessions - " + summary.nextTask);
    views.setOnClickPendingIntent(R.id.widgetRoot, DailyMoodWidgetUtils.openApp(context, "focus", 501));
    views.setOnClickPendingIntent(R.id.widgetAction, DailyMoodWidgetUtils.openApp(context, "focus", 502));
    manager.updateAppWidget(id, views);
  }
}
`;
}

// ── Tasks widget: list layout ────────────────────────────────────────────────
function widgetTasksLayout() {
  // One reusable task-row snippet (repeated for rows 1–4)
  function taskRow(n) {
    return `
  <LinearLayout
    android:id="@+id/widgetTask${n}Row"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="horizontal"
    android:gravity="center_vertical"
    android:layout_marginTop="5dp"
    android:visibility="gone">
    <TextView
      android:id="@+id/widgetTask${n}Dot"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:text="●"
      android:textSize="7sp"
      android:paddingRight="8dp" />
    <TextView
      android:id="@+id/widgetTask${n}"
      android:layout_width="0dp"
      android:layout_height="wrap_content"
      android:layout_weight="1"
      android:textColor="#1F2937"
      android:textSize="13sp"
      android:maxLines="1"
      android:ellipsize="end" />
  </LinearLayout>`;
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widgetRoot"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:orientation="vertical"
  android:padding="14dp"
  android:background="@drawable/widget_card_bg">

  <!-- Header row: eyebrow + count badge -->
  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="horizontal"
    android:gravity="center_vertical">

    <TextView
      android:layout_width="0dp"
      android:layout_height="wrap_content"
      android:layout_weight="1"
      android:text="TASKS"
      android:textColor="#2563EB"
      android:textSize="10sp"
      android:textStyle="bold"
      android:includeFontPadding="false" />

    <TextView
      android:id="@+id/widgetCount"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:background="@drawable/widget_badge_bg"
      android:textColor="#2563EB"
      android:textSize="11sp"
      android:textStyle="bold"
      android:paddingLeft="8dp"
      android:paddingRight="8dp"
      android:paddingTop="2dp"
      android:paddingBottom="2dp" />
  </LinearLayout>

  <!-- Divider -->
  <View
    android:layout_width="match_parent"
    android:layout_height="1dp"
    android:layout_marginTop="8dp"
    android:layout_marginBottom="2dp"
    android:background="#DDE3EC" />

  <!-- Task rows (shown/hidden at runtime) -->
${taskRow(1)}
${taskRow(2)}
${taskRow(3)}
${taskRow(4)}

  <!-- Empty state (shown when taskCount == 0) -->
  <TextView
    android:id="@+id/widgetEmpty"
    android:layout_width="match_parent"
    android:layout_height="0dp"
    android:layout_weight="1"
    android:gravity="center"
    android:text="All clear! 🎉"
    android:textColor="#6B7280"
    android:textSize="13sp"
    android:visibility="gone" />

  <!-- Spacer pushes button to bottom -->
  <View
    android:layout_width="match_parent"
    android:layout_height="0dp"
    android:layout_weight="1" />

  <!-- Action button -->
  <TextView
    android:id="@+id/widgetAction"
    android:layout_width="wrap_content"
    android:layout_height="28dp"
    android:minWidth="88dp"
    android:gravity="center"
    android:paddingLeft="14dp"
    android:paddingRight="14dp"
    android:background="@drawable/widget_button_bg"
    android:text="Open tasks"
    android:textColor="#FFFFFF"
    android:textSize="11sp"
    android:textStyle="bold" />
</LinearLayout>
`;
}

// ── Mood / Focus widgets: simple single-card layout ──────────────────────────
function widgetSimpleLayout({ eyebrow, action, accent }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widgetRoot"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:orientation="vertical"
  android:padding="14dp"
  android:background="@drawable/widget_card_bg">

  <TextView
    android:id="@+id/widgetEyebrow"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:text="${eyebrow}"
    android:textColor="${accent}"
    android:textSize="11sp"
    android:textStyle="bold"
    android:includeFontPadding="false" />

  <TextView
    android:id="@+id/widgetTitle"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="8dp"
    android:textColor="#111827"
    android:textSize="22sp"
    android:textStyle="bold"
    android:maxLines="1"
    android:ellipsize="end"
    android:includeFontPadding="false" />

  <TextView
    android:id="@+id/widgetValue"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="6dp"
    android:textColor="#243044"
    android:textSize="15sp"
    android:textStyle="bold"
    android:maxLines="2"
    android:ellipsize="end" />

  <TextView
    android:id="@+id/widgetDetail"
    android:layout_width="match_parent"
    android:layout_height="0dp"
    android:layout_weight="1"
    android:layout_marginTop="4dp"
    android:textColor="#6B7280"
    android:textSize="12sp"
    android:maxLines="2"
    android:ellipsize="end" />

  <TextView
    android:id="@+id/widgetAction"
    android:layout_width="wrap_content"
    android:layout_height="32dp"
    android:minWidth="92dp"
    android:gravity="center"
    android:paddingLeft="14dp"
    android:paddingRight="14dp"
    android:background="@drawable/widget_button_bg"
    android:text="${action}"
    android:textColor="#FFFFFF"
    android:textSize="12sp"
    android:textStyle="bold" />
</LinearLayout>
`;
}

function widgetInfo(layoutName, minHeight = '110dp') {
  return `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:minWidth="180dp"
  android:minHeight="${minHeight}"
  android:updatePeriodMillis="1800000"
  android:initialLayout="@layout/${layoutName}"
  android:resizeMode="horizontal|vertical"
  android:widgetCategory="home_screen" />
`;
}

const drawables = {
  'widget_card_bg.xml': `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
  <solid android:color="#F8F5EF" />
  <stroke android:width="1dp" android:color="#E2D8CA" />
  <corners android:radius="22dp" />
</shape>
`,
  'widget_button_bg.xml': `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
  <solid android:color="#111827" />
  <corners android:radius="14dp" />
</shape>
`,
  'widget_badge_bg.xml': `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
  <solid android:color="#EAF1FF" />
  <corners android:radius="8dp" />
</shape>
`,
};

function withWidgetFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const packageName = mod.android?.package || FALLBACK_PACKAGE;
      const androidRoot = mod.modRequest.platformProjectRoot;
      const javaDir = path.join(androidRoot, 'app', 'src', 'main', 'java', ...packageName.split('.'), 'widgets');
      const resDir = path.join(androidRoot, 'app', 'src', 'main', 'res');

      writeFile(path.join(javaDir, 'DailyMoodWidgetUtils.java'), javaUtils(packageName));
      writeFile(path.join(javaDir, 'DailyMoodTasksWidgetProvider.java'), javaTasksProvider(packageName));
      writeFile(path.join(javaDir, 'DailyMoodMoodWidgetProvider.java'), javaMoodProvider(packageName));
      writeFile(path.join(javaDir, 'DailyMoodPomodoroWidgetProvider.java'), javaPomodoroProvider(packageName));

      // Tasks widget: new list layout (taller minimum)
      writeFile(path.join(resDir, 'layout', 'widget_tasks.xml'), widgetTasksLayout());
      // Mood + Focus: existing simple layout
      writeFile(path.join(resDir, 'layout', 'widget_mood.xml'), widgetSimpleLayout({ eyebrow: 'MOOD', action: 'Log mood', accent: '#7C3AED' }));
      writeFile(path.join(resDir, 'layout', 'widget_pomodoro.xml'), widgetSimpleLayout({ eyebrow: 'FOCUS', action: 'Start timer', accent: '#0D9488' }));

      // Widget provider metadata
      writeFile(path.join(resDir, 'xml', 'widget_tasks_info.xml'),    widgetInfo('widget_tasks', '200dp'));
      writeFile(path.join(resDir, 'xml', 'widget_mood_info.xml'),     widgetInfo('widget_mood'));
      writeFile(path.join(resDir, 'xml', 'widget_pomodoro_info.xml'), widgetInfo('widget_pomodoro'));

      // Drawables (card background, button, badge)
      for (const [name, contents] of Object.entries(drawables)) {
        writeFile(path.join(resDir, 'drawable', name), contents);
      }

      return mod;
    },
  ]);
}

module.exports = function withAndroidWidgets(config) {
  config = withWidgetReceivers(config);
  return withWidgetFiles(config);
};
