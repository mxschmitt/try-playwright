package worker

import (
	"fmt"
	"log"
	"os"
	"sync"

	"github.com/fsnotify/fsnotify"
)

type filesCollector struct {
	tmpDir  string
	done    chan bool
	watcher *fsnotify.Watcher

	filesMu sync.Mutex
	files   []string
}

func newFilesCollector() (*filesCollector, error) {
	tmpDir, err := os.MkdirTemp("", "try-pw")
	if err != nil {
		return nil, fmt.Errorf("could not create tmp dir: %w", err)
	}
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("could not create new fs watcher: %w", err)
	}
	if err := watcher.Add(tmpDir); err != nil {
		return nil, fmt.Errorf("could not add tmpDir to watcher: %w", err)
	}
	fw := &filesCollector{
		done:    make(chan bool),
		watcher: watcher,
		tmpDir:  tmpDir,
		files:   []string{},
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
			log.Println("event:", event)
			if event.Op&fsnotify.Create == fsnotify.Create {
				fi, err := os.Stat(event.Name)
				if err != nil {
					log.Printf("could not stat: %v", err)
					return
				}
				if fi.IsDir() {
					if err := fw.watcher.Add(event.Name); err != nil {
						log.Printf("could not add folder recursively: %v", err)
						return
					}
				} else {
					fw.filesMu.Lock()
					fw.files = append(fw.files, event.Name)
					fw.filesMu.Unlock()
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
