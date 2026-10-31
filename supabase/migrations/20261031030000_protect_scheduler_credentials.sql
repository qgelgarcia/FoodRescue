-- Request headers can contain the scheduler secret; only server roles may inspect them.
revoke all on net.http_request_queue, net._http_response from public,anon,authenticated;
revoke all on vault.secrets, vault.decrypted_secrets from public,anon,authenticated;
