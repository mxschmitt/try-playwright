package main

import (
	"context"
	"encoding/json"
	"fmt"

	"go.etcd.io/etcd/clientv3"
)

type etcdOneShotStorage struct {
	etcdClient *clientv3.Client
	prefix     string
}

func newEtcdOneShotStorage(etcdClient *clientv3.Client, prefix string) *etcdOneShotStorage {
	return &etcdOneShotStorage{
		etcdClient: etcdClient,
		prefix:     prefix,
	}
}

func (s *etcdOneShotStorage) generateEtcdKey(id string) string {
	return fmt.Sprintf("%s/%s", s.prefix, id)
}

func (s *etcdOneShotStorage) SavePayload(id string, payload interface{}) error {
	var err error
	var value []byte
	if p, ok := payload.([]byte); ok {
		value = p
	} else {
		value, err = json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("could not create json: %w", err)
		}
	}
	_, err = s.etcdClient.Put(context.Background(), s.generateEtcdKey(id), string(value))
	if err != nil {
		return fmt.Errorf("could not save etcd value: %w", err)
	}
	return nil
}

func (s *etcdOneShotStorage) GetPayloadOneShot(id string) ([]byte, error) {
	resp, err := s.etcdClient.Delete(context.Background(), s.generateEtcdKey(id), clientv3.WithPrevKV())
	if err != nil {
		return nil, fmt.Errorf("could not save etcd value: %w", err)
	}
	return resp.PrevKvs[0].Value, nil
}

type payloadStorage struct {
	storage *etcdOneShotStorage
}

func newPayloadStorage(etcdClient *clientv3.Client) *payloadStorage {
	return &payloadStorage{
		storage: newEtcdOneShotStorage(etcdClient, "payloads"),
	}
}

func (s *payloadStorage) SavePayload(id string, payload *workerPayload) error {
	return s.storage.SavePayload(id, payload)
}

func (s *payloadStorage) GetPayloadOneShot(id string) (*workerPayload, error) {
	resp, err := s.storage.GetPayloadOneShot(id)
	if err != nil {
		return nil, err
	}
	var payload *workerPayload
	if err := json.Unmarshal(resp, &payload); err != nil {
		return nil, fmt.Errorf("could not decode json: %w", err)
	}
	return payload, nil
}

type responseStorage struct {
	storage *etcdOneShotStorage
}

func newResponseStorage(etcdClient *clientv3.Client) *responseStorage {
	return &responseStorage{
		storage: newEtcdOneShotStorage(etcdClient, "responses"),
	}
}

func (s *responseStorage) SavePayload(id string, payload []byte) error {
	return s.storage.SavePayload(id, payload)
}

func (s *responseStorage) GetPayloadOneShot(id string) (*workerResponsePayload, error) {
	resp, err := s.storage.GetPayloadOneShot(id)
	if err != nil {
		return nil, err
	}
	var payload *workerResponsePayload
	if err := json.Unmarshal(resp, &payload); err != nil {
		return nil, fmt.Errorf("could not decode json: %w", err)
	}
	return payload, nil
}
