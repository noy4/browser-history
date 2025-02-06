# Browser History Plugin for Obsidian

This plugin syncs your browser history to Obsidian notes, making your browsing history searchable and manageable within Obsidian.

## Features

- Sync browser history to Obsidian notes
- Automatically sync on Obsidian startup
- Configure automatic sync intervals
- Quick access to today's history via ribbon icon
- Customizable note storage location

## Settings

### Database Location
Path to your browser history database file. Default location for Brave browser:
```
/Users/noy/Library/Application Support/BraveSoftware/Brave-Browser/Default/History
```

### Check Connection
Test the connection to your browser history database. Shows the total number of records and the oldest record date when successful.

### New File Location
Directory where your browser history notes will be saved. Default: `Browser History`

### Start Date
Starting date for history note creation. This automatically updates to today after each sync.

### Sync
Manually trigger the creation or update of history notes from the specified start date.

### Sync on Startup
Enable automatic synchronization when Obsidian starts.

### Auto Sync
Set an interval for automatic history note synchronization. Available options:
- Disabled
- 1 minute
- 5 minutes
- 10 minutes
- 30 minutes
- 5 seconds (for testing)

## Installation

1. Open Obsidian Settings
2. Navigate to Community Plugins and disable Safe Mode
3. Click Browse and search for "Browser History"
4. Install the plugin and enable it

## Usage

1. Configure the database location in settings to point to your browser's history file
2. Set your preferred note storage location
3. Use the "Check Connection" button to verify database access
4. Set a start date and click "Sync" to create history notes
5. Optionally enable automatic sync features

The plugin will create daily notes containing your browsing history, organized by date. You can quickly access today's history using the clock icon in the ribbon.
