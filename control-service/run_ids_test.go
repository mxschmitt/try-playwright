package main

import "testing"

func TestResolveRunTestID(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, header, body, requestID, want string
	}{
		{name: "body wins over header", header: "from-header", body: "from-body", requestID: "req", want: "from-body"},
		{name: "header when body empty", header: "from-header", body: "", requestID: "req", want: "from-header"},
		{name: "request id fallback", header: "", body: "", requestID: "req", want: "req"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := resolveRunTestID(tc.header, tc.body, tc.requestID)
			if got != tc.want {
				t.Fatalf("got %q want %q", got, tc.want)
			}
		})
	}
}
