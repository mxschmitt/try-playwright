package worker

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"

	"github.com/fsnotify/fsnotify"
)

type filesCollector struct {
	dir            string
	ignorePatterns []string
	done           chan bool
	watcher        *fsnotify.Watcher

	filesMu sync.Mutex
	files   []string
}

func newFilesCollector(dir string, ignorePatterns []string) (*filesCollector, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("could not create new fs watcher: %w", err)
	}
	if err := watcher.Add(dir); err != nil {
		return nil, fmt.Errorf("could not add dir to watcher: %w", err)
	}
	fw := &filesCollector{
		done:           make(chan bool),
		watcher:        watcher,
		dir:            dir,
		ignorePatterns: ignorePatterns,
		files:          []string{},
	}
	go fw.watch()
	return fw, nil
}

func (fw *filesCollector) Collect() ([]string, error) {
	fw.done <- true
	fw.filesMu.Lock()
	defer fw.filesMu.Unlock()
	defer fw.watcher.Close()
	return fw.files, nil
}

func (fw *filesCollector) watch() {
	for {
		select {
		case <-fw.done:
			return
		case event, ok := <-fw.watcher.Events:
			if !ok {
				return
			}
			if event.Op&fsnotify.Create == fsnotify.Create {
				if err := fw.consumeCreateEvent(event); err != nil {
					log.Printf("could n ot consume create event: %v", err)
					return
				}
			}
		case err, ok := <-fw.watcher.Errors:
			if !ok {
				return
			}
			log.Printf("could not watch: %v", err)
		}
	}
}

func (fw *filesCollector) consumeCreateEvent(event fsnotify.Event) error {
	for _, ignorePattern := range fw.ignorePatterns {
		matched, err := filepath.Match(ignorePattern, event.Name)
		if err != nil {
			return fmt.Errorf("could not match pattern: %w", err)
		}
		if matched {
			return nil
		}
	}

	fi, err := os.Stat(event.Name)
	if err != nil {
		return fmt.Errorf("could not stat: %w", err)
	}
	if fi.IsDir() {
		if err := fw.watcher.Add(event.Name); err != nil {
			return fmt.Errorf("could not add folder recursivelyt: %w", err)
		}
		return nil
	}

	fw.filesMu.Lock()
	fw.files = append(fw.files, event.Name)
	fw.filesMu.Unlock()
	return nil
}
