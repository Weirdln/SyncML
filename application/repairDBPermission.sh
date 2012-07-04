#!/bin/bash
#
echo del account 
luna-send -n 1 -a info.mobo.syncml.service luna://com.palm.db/delKind '{"id":"info.mobo.syncml.account:1"}'
echo del calendar
luna-send -n 1 -a info.mobo.syncml.service luna://com.palm.db/delKind '{"id":"info.mobo.syncml.calendar:1"}'
echo del calendarevent
luna-send -n 1 -a info.mobo.syncml.service luna://com.palm.db/delKind '{"id":"info.mobo.syncml.calendarevent:1"}'
echo del contact
luna-send -n 1 -a info.mobo.syncml.service luna://com.palm.db/delKind '{"id":"info.mobo.syncml.contact:1"}'
#
echo create account
luna-send -n 1 -a info.mobo.syncml.client.service luna://com.palm.db/putKind '{"id":"info.mobo.syncml.account:1", "sync": true, "indexes": [{"name": "webOsAccountId","props": [{"name": "webOsAccountId"}]}],"owner":"info.mobo.syncml.client.service"}'
echo create calendar
luna-send -n 1 -a info.mobo.syncml.client.service luna://com.palm.db/putKind '{"id":"info.mobo.syncml.calendar:1","sync": false,"extends": ["com.palm.calendar:1"], "indexes": [{"name": "accountId", "props": [{"name": "accountId"}]}],"owner":"info.mobo.syncml.client.service"}'
echo create calendarevent
luna-send -n 1 -a info.mobo.syncml.client.service luna://com.palm.db/putKind '{"id": "info.mobo.syncml.calendarevent:1","sync": false,"extends": ["com.palm.calendarevent:1"],"indexes":[{ "name":"accountIdRevision", "incDel": true, "props": [{"name": "accountId"}, {"name": "_rev"}]},{ "name":"calendarIdRevision", "incDel": true, "props": [{"name": "calendarId"}, {"name": "_rev"}]},{ "name":"calendarId", "incDel": false, "props": [{"name": "calendarId"}]},{ "name":"revNumber", "incDel": true, "props": [{"name": "_rev"}]},{ "name":"parentId", "props": [{"name": "parentId"}]}],"owner":"info.mobo.syncml.client.service"}'
echo create contact
luna-send -n 1 -a info.mobo.syncml.client.service luna://com.palm.db/putKind '{"id": "info.mobo.syncml.contact:1","sync": false,"extends": ["com.palm.contact:1"],"indexes": [{"name": "imsi_name_index","props": [{"name":"syncSource.extended.imsi"}, {"name":"syncSource.name"}, {"name":"syncSource.extended.index"}]}, {"name": "folderId_rev","props": [{"name": "folderId"}, {"name": "_rev"}]}, {"name": "rev","props": [{"name": "_rev"}],"incDel":true}, {"name": "rev_folderId","props": [{"name": "_rev"}, {"name": "folderId"}]}, {"name": "accountId","props": [{"name": "accountId"}]}, {"name": "remoteId","props": [{"name": "remoteId"}]}],"owner":"info.mobo.syncml.client.service"}'
#
echo set perm account
luna-send -n 1 -a info.mobo.syncml.client.service luna://com.palm.db/putPermissions '{"permissions":[{"type": "db.kind","object": "info.mobo.syncml.account:1","caller": "info.mobo.syncml.client","operations": {"read": "allow","create": "allow","delete": "allow","update": "allow"}},{"type": "db.kind","object": "info.mobo.syncml.account:1","caller": "info.mobo.syncml.client.service","operations": {"read": "allow","create": "allow","delete": "allow","update": "allow"}}]}'
echo set perm calendar
luna-send -n 1 -a info.mobo.syncml.client.service luna://com.palm.db/putPermissions '{"permissions":[{"type": "db.kind","object": "info.mobo.syncml.calendar:1","caller": "info.mobo.syncml.client","operations": {"read": "allow","create": "allow","delete": "allow","update": "allow"}},{"type": "db.kind","object": "info.mobo.syncml.calendar:1","caller": "info.mobo.syncml.client.service","operations": {"read": "allow","create": "allow","delete": "allow","update": "allow"}},{ "type"    : "db.kind", "object"  : "info.mobo.syncml.calendar:1", "caller"  : "com.palm.app.calendar", "operations":{ "create": "allow", "read"  : "allow", "update": "allow", "delete": "allow"}}, { "type"    : "db.kind", "object"  : "info.mobo.syncml.calendar:1", "caller"  : "com.palm.service.calendar.*", "operations":{ "read"  : "allow", "delete": "allow", "extend": "allow"}}, { "type"    : "db.kind", "object"  : "info.mobo.syncml.calendar:1", "caller"  : "com.palm.eas", "operations":{ "read"  : "allow", "extend": "allow"}}, { "type"    : "db.kind", "object"  : "info.mobo.syncml.calendar:1", "caller"  : "com.palm.service.calendar.google", "operations":{ "create": "allow", "read"  : "allow", "update": "allow", "delete": "allow", "extend": "allow"}},{ "type"    : "db.kind", "object"  : "info.mobo.syncml.calendar:1", "caller"  : "com.palm.service.calendar.yahoo", "operations":{ "create": "allow", "read"  : "allow", "update": "allow", "delete": "allow", "extend": "allow"}},{ "type"    : "db.kind","object"  : "info.mobo.syncml.calendar:1","caller"  : "com.palm.dataimport","operations":{ "read"  : "allow"}},{ "type"    : "db.kind","object"  : "info.mobo.syncml.calendar:1","caller"  : "com.palm.app.dataimport","operations":{ "read"  : "allow"}},{ "type"    : "db.kind","object"  : "info.mobo.syncml.calendar:1","caller"  : "com.palm.app.agendaview","operations":{ "read"  : "allow"}},{ "type"    : "db.kind","object"  : "info.mobo.syncml.calendar:1","caller"  : "com.palm.app.enyo-calendar","operations":{ "create": "allow","read"  : "allow","update": "allow","delete": "allow"}}]}'
echo set perm calendarevent
luna-send -n 1 -a info.mobo.syncml.client.service luna://com.palm.db/putPermissions '{"permissions":[{"type": "db.kind","object": "info.mobo.syncml.calendarevent:1","caller": "info.mobo.syncml.client","operations": {"read": "allow","create": "allow","delete": "allow","update": "allow"}},{"type": "db.kind","object": "info.mobo.syncml.calendarevent:1","caller": "info.mobo.syncml.client.service","operations": {"read": "allow","create": "allow","delete": "allow","update": "allow"}},{ "type"    : "db.kind", "object"  : "info.mobo.syncml.calendarevent:1", "caller"  : "com.palm.app.calendar", "operations":{ "create": "allow", "read"  : "allow", "update": "allow", "delete": "allow"}}, { "type"    : "db.kind", "object"  : "info.mobo.syncml.calendarevent:1", "caller"  : "com.palm.service.calendar.*", "operations":{ "read"  : "allow", "delete": "allow", "extend": "allow"}}, { "type"    : "db.kind", "object"  : "info.mobo.syncml.calendarevent:1", "caller"  : "com.palm.eas", "operations":{ "extend": "allow"}}, { "type"    : "db.kind", "object"  : "info.mobo.syncml.calendarevent:1", "caller"  : "com.palm.service.calendar.reminders", "operations":{ "read"  : "allow"}}, { "type"    : "db.kind", "object"  : "info.mobo.syncml.calendarevent:1", "caller"  : "com.palm.service.calendar.google", "operations":{ "create": "allow", "read"  : "allow", "update": "allow", "delete": "allow", "extend": "allow"}}, { "type"    : "db.kind", "object"  : "info.mobo.syncml.calendarevent:1", "caller"  : "com.palm.service.calendar.yahoo", "operations":{ "create": "allow", "read"  : "allow", "update": "allow", "delete": "allow", "extend": "allow"}}, { "type"    : "db.kind", "object"  : "info.mobo.syncml.calendarevent:1", "caller"  : "com.palm.dataimport", "operations":{ "create": "allow", "read"  : "allow", "update": "allow", "delete": "allow", "extend": "allow"}}, { "type"    : "db.kind", "object"  : "info.mobo.syncml.calendarevent:1", "caller"  : "com.palm.app.agendaview", "operations":{ "read"  : "allow"}}, { "type"    : "db.kind", "object"  : "info.mobo.syncml.calendarevent:1", "caller"  : "com.palm.app.enyo-calendar", "operations":{ "create": "allow", "read"  : "allow", "update": "allow", "delete": "allow"}}]}'
echo set perm contact
luna-send -n 1 -a info.mobo.syncml.client.service luna://com.palm.db/putPermissions '{"permissions":[{"type": "db.kind","object": "info.mobo.syncml.contact:1","caller": "info.mobo.syncml.client","operations": {"read": "allow","create": "allow","delete": "allow","update": "allow"}},{"type": "db.kind","object": "info.mobo.syncml.contact:1","caller": "info.mobo.syncml.client.service","operations": {"read": "allow","create": "allow","delete": "allow","update": "allow"}},{"type": "db.kind","object": "info.mobo.syncml.contact:1","caller": "*","operations": {"extend": "allow"}},{"type": "db.kind","object": "info.mobo.syncml.contact:1","caller": "com.palm.service.contacts.linker","operations": {"read": "allow","create": "allow"}},{"type": "db.kind","object": "info.mobo.syncml.contact:1","caller": "com.palm.app.contacts","operations": {"read": "allow","create": "allow","delete": "allow","update": "allow"}},{"type": "db.kind","object": "info.mobo.syncml.contact:1","caller": "com.palm.app.enyo-contacts","operations": {"read": "allow","create": "allow","delete": "allow","update": "allow"}},{"type": "db.kind","object": "info.mobo.syncml.contact:1","caller": "com.palm.dataimport","operations": {"read": "allow","create": "allow"}},{"type": "db.kind","object": "info.mobo.syncml.contact:1","caller": "com.palm.service.contacts","operations": {"read": "allow","create": "allow","update": "allow"}},{"type": "db.kind","object": "info.mobo.syncml.contact:1","caller": "com.palm.*","operations": {"read": "allow"}}]}'
