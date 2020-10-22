package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"go.etcd.io/etcd/clientv3"
)

func main() {
	dbLocationPtr := flag.String("db", "/db.sqlite", "SQLite database path")
	etcdEndpointPtr := flag.String("etcd", "etcd:2379", "ETCD endpoint")
	flag.Parse()
	db, err := sql.Open("sqlite3", *dbLocationPtr)
	if err != nil {
		log.Fatalf("could not open database: %v", err)
	}
	etcdClient, err := clientv3.New(clientv3.Config{
		Endpoints:   []string{*etcdEndpointPtr},
		DialTimeout: 5 * time.Second,
	})
	if err != nil {
		log.Fatalf("could not open etcd: %v", err)
	}
	rows, err := db.Query("SELECT id, code FROM shares")
	if err != nil {
		log.Fatalf("could not query: %v", err)
	}
	defer rows.Close()
	var (
		id   string
		code string
	)
	i := 0
	for rows.Next() {
		err := rows.Scan(&id, &code)
		if err != nil {
			log.Fatal(err)
		}
		if _, err = etcdClient.Put(context.Background(), id, code); err != nil {
			log.Fatalf("could not put: %v", err)
		}
		i++
	}
	fmt.Printf("migrated %d records\n", i)
}
