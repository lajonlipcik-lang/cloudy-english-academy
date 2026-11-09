import '../domain/cloudy_learning_store.dart';
import '../network/cloudy_backend_client.dart';

class CloudyLearningSyncRepository {
  const CloudyLearningSyncRepository(this._store, this._backend);
  final CloudyLearningStore _store;
  final CloudyBackendClient _backend;

  Future<int> syncPending(String accessToken, {int limit = 50}) async {
    final events = _store.pending(limit: limit);
    if (events.isEmpty) return 0;
    final result = await _backend.syncLearningEvents(
      accessToken: accessToken,
      events: events,
    );
    final accepted = result['acceptedEventIds'];
    if (accepted is! List) return 0;
    final ids = accepted.whereType<String>().toList(growable: false);
    return _store.acknowledge(ids);
  }
}
